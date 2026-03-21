from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import websockets

from kgm_backend.config import ServerConfig
from kgm_backend.contracts import (
    ActiveModel,
    ErrorMessage,
    GetStatusRequest,
    ImageSize,
    ReadyMessage,
    ResultMessage,
    StartRequest,
    StatusMessage,
    StopRequest,
)
from kgm_backend.models.base import Detector
from kgm_backend.models.mediapipe_hands import MediaPipeHandsDetector
from kgm_backend.models.mediapipe_pose import MediaPipePoseDetector
from kgm_backend.models.movenet import MoveNetDetector
from kgm_backend.stream import MjpegStreamServer

log = logging.getLogger("kgm")


@dataclass(slots=True)
class InferenceSession:
    request: StartRequest
    active_model: ActiveModel
    camera: cv2.VideoCapture
    detector: Detector
    task: asyncio.Task[None]


class CameraInferenceServer:
    def __init__(self, config: ServerConfig) -> None:
        self._config = config
        self._clients: set[Any] = set()
        self._session: InferenceSession | None = None
        self._lock = asyncio.Lock()
        self._stream_server = MjpegStreamServer(
            host=config.host,
            port=config.stream_port,
        )

    async def handle_client(self, websocket: Any) -> None:
        self._clients.add(websocket)
        remote = getattr(websocket, "remote_address", "unknown")
        log.info("Client connected: %s (total: %d)", remote, len(self._clients))
        await self._send_status(websocket)
        try:
            async for raw_message in websocket:
                await self._handle_message(websocket, raw_message)
        finally:
            self._clients.discard(websocket)
            log.info("Client disconnected: %s (total: %d)", remote, len(self._clients))

    async def _handle_message(self, websocket: Any, raw_message: str) -> None:
        try:
            message = json.loads(raw_message)
            request = self._parse_request(message)
        except (ValueError, TypeError, KeyError) as exc:
            await self._send_message(websocket, ErrorMessage(error=str(exc)).to_payload())
            return

        if isinstance(request, StartRequest):
            try:
                await self._start_session(request)
            except Exception as exc:
                await self._send_message(websocket, ErrorMessage(error=str(exc)).to_payload())
                await self._broadcast_status()
            return

        if isinstance(request, StopRequest):
            await self._stop_session()
            await self._broadcast_status()
            return

        if isinstance(request, GetStatusRequest):
            await self._send_status(websocket)

    def _parse_request(self, payload: dict[str, Any]) -> StartRequest | StopRequest | GetStatusRequest:
        message_type = payload.get("type")
        if message_type == "stop":
            return StopRequest()
        if message_type == "get_status":
            return GetStatusRequest()
        if message_type != "start":
            raise ValueError("Unsupported message type")

        model = payload.get("model")
        if not isinstance(model, dict):
            raise ValueError("Field 'model' is required")

        model_type = str(model.get("type", "")).strip()
        version = str(model.get("version", "")).strip()
        if model_type not in {"movenet", "blazepose", "handpose"}:
            raise ValueError("Unsupported model type")
        if not version:
            raise ValueError("Field 'model.version' is required")
        self._validate_model_version(model_type, version)

        camera = payload.get("camera") if isinstance(payload.get("camera"), dict) else {}
        options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
        return StartRequest(
            model_type=model_type,
            version=version,
            camera_source=camera.get("source", self._config.default_camera_source),
            width=_optional_int(camera.get("width")),
            height=_optional_int(camera.get("height")),
            fps=_optional_int(camera.get("fps")),
            min_detection_confidence=_optional_float(
                options.get("min_detection_confidence"),
                default=0.5,
            ),
            min_tracking_confidence=_optional_float(
                options.get("min_tracking_confidence"),
                default=0.5,
            ),
            max_hands=max(1, _optional_int(options.get("max_hands"), default=2) or 2),
        )

    async def _start_session(self, request: StartRequest) -> None:
        log.info(
            "Starting session: model=%s/%s camera=%s",
            request.model_type,
            request.version,
            request.camera_source,
        )
        previous_session = await self._detach_session()
        await self._shutdown_session(previous_session)

        camera: cv2.VideoCapture | None = None
        detector: Detector | None = None
        try:
            camera = self._open_camera(request)
            detector = self._create_detector(request)
            active_model = self._build_active_model(request)
            task = asyncio.create_task(self._run_session(camera, detector, request, active_model))
        except Exception:
            log.exception("Failed to start session")
            if detector is not None:
                detector.close()
            if camera is not None:
                camera.release()
            raise

        async with self._lock:
            self._session = InferenceSession(
                request=request,
                active_model=active_model,
                camera=camera,
                detector=detector,
                task=task,
            )

        await self._broadcast(ReadyMessage(activeModel=active_model).to_payload())
        await self._broadcast_status()
        log.info("Session started: %s", active_model.name)

    async def _stop_session(self) -> None:
        log.info("Stopping session")
        session = await self._detach_session()
        await self._shutdown_session(session)
        log.info("Session stopped")

    async def _detach_session(self) -> InferenceSession | None:
        async with self._lock:
            session = self._session
            self._session = None
            return session

    async def _shutdown_session(self, session: InferenceSession | None) -> None:
        if session is None:
            return

        session.task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await session.task

    async def _run_session(
        self,
        camera: cv2.VideoCapture,
        detector: Detector,
        request: StartRequest,
        active_model: ActiveModel,
    ) -> None:
        frame_interval = 1.0 / max(1, request.fps or self._config.target_fps)
        try:
            while True:
                started_at = time.perf_counter()
                ok, frame = await asyncio.to_thread(camera.read)
                if not ok or frame is None:
                    raise RuntimeError("Unable to read a frame from the configured camera source")

                # Push frame to MJPEG stream viewers
                _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                self._stream_server.push_frame(jpeg.tobytes())

                predictions = await asyncio.to_thread(detector.predict, frame)
                height, width, _ = frame.shape
                message = ResultMessage(
                    timestamp=int(time.time() * 1000),
                    activeModel=active_model,
                    imageSize=ImageSize(width=width, height=height),
                    predictions=predictions,
                )
                await self._broadcast(message.to_payload())

                elapsed = time.perf_counter() - started_at
                await asyncio.sleep(max(0.0, frame_interval - elapsed))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.exception("Session loop error")
            await self._broadcast(ErrorMessage(error=str(exc)).to_payload())
        finally:
            log.info("Releasing camera and detector")
            detector.close()
            camera.release()
            async with self._lock:
                if self._session and self._session.active_model == active_model:
                    self._session = None
            await self._broadcast_status()

    def _open_camera(self, request: StartRequest) -> cv2.VideoCapture:
        source = request.camera_source
        if isinstance(source, str) and source.isdigit():
            source = int(source)

        log.info("Opening camera source: %s", source)
        available = self._list_video_devices()
        if available:
            log.info("Available video devices: %s", ", ".join(available))
        else:
            log.warning("No /dev/video* devices found on this system")

        camera = self._try_open_camera(source)

        # If the requested source failed and it was an integer, try other devices
        if camera is None and isinstance(source, int):
            for dev in available:
                alt = dev.replace("/dev/video", "")
                if alt.isdigit() and int(alt) != source:
                    alt_idx = int(alt)
                    log.info("Trying fallback camera source: %d", alt_idx)
                    camera = self._try_open_camera(alt_idx)
                    if camera is not None:
                        log.info("Fallback camera %d succeeded", alt_idx)
                        break

        if camera is None:
            log.error(
                "Camera source %s could not be opened. "
                "Hints: check device permissions (ls -l /dev/video*), "
                "ensure no other process is using the camera (fuser /dev/video*), "
                "or set KGM_CAMERA_SOURCE to the correct device index.",
                source,
            )
            raise RuntimeError(f"Unable to open camera source: {source}")

        if request.width is not None:
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, request.width)
        if request.height is not None:
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, request.height)
        if request.fps is not None:
            camera.set(cv2.CAP_PROP_FPS, request.fps)

        log.info(
            "Camera opened: %sx%s @ %s fps (backend: %s)",
            int(camera.get(cv2.CAP_PROP_FRAME_WIDTH)),
            int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            int(camera.get(cv2.CAP_PROP_FPS)),
            camera.getBackendName(),
        )
        return camera

    @staticmethod
    def _list_video_devices() -> list[str]:
        """List available /dev/video* devices."""
        import glob
        devices = sorted(glob.glob("/dev/video*"))
        return devices

    @staticmethod
    def _try_open_camera(source: int | str) -> cv2.VideoCapture | None:
        """Try to open a camera source, returning None on failure."""
        # On Linux, prefer V4L2 backend for integer sources
        backends = []
        if isinstance(source, int) and hasattr(cv2, "CAP_V4L2"):
            backends.append(("V4L2", cv2.CAP_V4L2))
        backends.append(("auto", cv2.CAP_ANY))

        for name, api in backends:
            log.info("Trying camera %s with backend %s", source, name)
            cap = cv2.VideoCapture(source, api)
            if cap.isOpened():
                # Verify we can actually grab a frame
                ok, _ = cap.read()
                if ok:
                    return cap
                log.warning("Camera %s opened with %s but failed to read a frame", source, name)
                cap.release()
            else:
                cap.release()
        return None

    def _create_detector(self, request: StartRequest) -> Detector:
        log.info("Creating detector: %s/%s", request.model_type, request.version)
        if request.model_type == "movenet":
            model_path = self._resolve_movenet_path(request.version)
            return MoveNetDetector(model_path=model_path)

        if request.model_type == "blazepose":
            model_path = self._resolve_pose_landmarker_path(request.version)
            return MediaPipePoseDetector(
                model_path=model_path,
                min_detection_confidence=request.min_detection_confidence,
                min_tracking_confidence=request.min_tracking_confidence,
            )

        if request.model_type == "handpose":
            return MediaPipeHandsDetector(
                model_path=self._config.hand_landmarker_path,
                min_detection_confidence=request.min_detection_confidence,
                min_tracking_confidence=request.min_tracking_confidence,
                max_hands=request.max_hands,
            )

        raise ValueError(f"Unsupported model type: {request.model_type}")

    def _resolve_movenet_path(self, version: str) -> Path:
        if version == "lightning":
            return self._config.movenet_lightning_path
        if version == "thunder":
            return self._config.movenet_thunder_path
        raise ValueError(f"Unsupported MoveNet version: {version}")

    def _resolve_pose_landmarker_path(self, version: str) -> Path:
        paths = {
            "lite": self._config.pose_landmarker_lite_path,
            "full": self._config.pose_landmarker_full_path,
            "heavy": self._config.pose_landmarker_heavy_path,
        }
        if version not in paths:
            raise ValueError(f"Unsupported BlazePose version: {version}")
        return paths[version]

    def _build_active_model(self, request: StartRequest) -> ActiveModel:
        model_names: dict[tuple[str, str], str] = {
            ("movenet", "lightning"): "MoveNet SinglePose Lightning",
            ("movenet", "thunder"): "MoveNet SinglePose Thunder",
            ("blazepose", "lite"): "MediaPipe Pose Landmark Lite",
            ("blazepose", "full"): "MediaPipe Pose Landmark Full",
            ("blazepose", "heavy"): "MediaPipe Pose Landmark Heavy",
            ("handpose", "lite"): "MediaPipe Hand Landmark Lite",
            ("handpose", "full"): "MediaPipe Hand Landmark Full",
        }
        return ActiveModel(
            type=request.model_type,
            version=request.version,
            name=model_names[(request.model_type, request.version)],
        )

    def _validate_model_version(self, model_type: str, version: str) -> None:
        valid_versions = {
            "movenet": {"lightning", "thunder"},
            "blazepose": {"lite", "full", "heavy"},
            "handpose": {"lite", "full"},
        }
        if version not in valid_versions[model_type]:
            raise ValueError(
                f"Unsupported version '{version}' for model '{model_type}'"
            )

    async def _send_status(self, websocket: Any) -> None:
        await self._send_message(websocket, self._status_message().to_payload())

    async def _broadcast_status(self) -> None:
        await self._broadcast(self._status_message().to_payload())

    def _status_message(self) -> StatusMessage:
        session = self._session
        return StatusMessage(
            running=session is not None,
            activeModel=session.active_model if session else None,
            cameraSource=session.request.camera_source if session else None,
        )

    async def _broadcast(self, payload: dict[str, object]) -> None:
        if not self._clients:
            return
        message = json.dumps(payload)
        stale_clients: list[Any] = []
        for client in self._clients:
            try:
                await client.send(message)
            except Exception:
                stale_clients.append(client)
        for client in stale_clients:
            self._clients.discard(client)

    async def _send_message(self, websocket: Any, payload: dict[str, object]) -> None:
        await websocket.send(json.dumps(payload))


def _optional_int(value: Any, default: int | None = None) -> int | None:
    if value is None:
        return default
    return int(value)


def _optional_float(value: Any, default: float) -> float:
    if value is None:
        return default
    return float(value)


def _parse_camera_arg(value: str) -> int | str:
    """Parse a --camera CLI value into an int index or string path."""
    stripped = value.strip()
    if stripped.isdigit():
        return int(stripped)
    return stripped


async def _serve(config: ServerConfig) -> None:
    log.info(
        "Starting server — WS on %s:%d, MJPEG stream on %s:%d",
        config.host,
        config.port,
        config.host,
        config.stream_port,
    )
    server = CameraInferenceServer(config)

    # Log camera devices at startup for diagnostics
    devices = server._list_video_devices()
    if devices:
        log.info("Detected video devices: %s", ", ".join(devices))
    else:
        log.warning(
            "No /dev/video* devices detected. Camera will not be available. "
            "If using USB, check the connection. If using a virtual device, "
            "set KGM_CAMERA_SOURCE to the correct path."
        )
    log.info("Default camera source: %s", config.default_camera_source)

    await server._stream_server.start()
    log.info("MJPEG stream server ready")
    try:
        async with websockets.serve(server.handle_client, config.host, config.port):
            log.info("WebSocket server ready — listening on ws://%s:%d", config.host, config.port)
            await asyncio.Future()
    finally:
        await server._stream_server.stop()


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Kinkagami camera inference websocket backend")
    parser.add_argument("--host", default=None, help="WebSocket bind host")
    parser.add_argument("--port", type=int, default=None, help="WebSocket bind port")
    parser.add_argument("--stream-port", type=int, default=None, help="MJPEG stream HTTP port")
    parser.add_argument("--camera", default=None, help="Camera source (device index or path, e.g. 0, /dev/video2)")
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # Suppress noisy handshake errors from health-check TCP probes
    logging.getLogger("websockets").setLevel(logging.CRITICAL)
    args = _build_arg_parser().parse_args()
    base_config = ServerConfig.from_env()
    config = ServerConfig(
        host=args.host or base_config.host,
        port=args.port or base_config.port,
        stream_port=args.stream_port or base_config.stream_port,
        default_camera_source=_parse_camera_arg(args.camera) if args.camera else base_config.default_camera_source,
        target_fps=base_config.target_fps,
        movenet_lightning_path=base_config.movenet_lightning_path,
        movenet_thunder_path=base_config.movenet_thunder_path,
        hand_landmarker_path=base_config.hand_landmarker_path,
        pose_landmarker_lite_path=base_config.pose_landmarker_lite_path,
        pose_landmarker_full_path=base_config.pose_landmarker_full_path,
        pose_landmarker_heavy_path=base_config.pose_landmarker_heavy_path,
    )
    asyncio.run(_serve(config))


if __name__ == "__main__":
    main()
