from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _parse_camera_source(raw: str) -> int | str:
    stripped = raw.strip()
    if stripped.isdigit():
        return int(stripped)
    return stripped


@dataclass(frozen=True, slots=True)
class ServerConfig:
    host: str
    port: int
    stream_port: int
    default_camera_source: int | str
    target_fps: int
    movenet_lightning_path: Path
    movenet_thunder_path: Path
    hand_landmarker_path: Path
    pose_landmarker_lite_path: Path
    pose_landmarker_full_path: Path
    pose_landmarker_heavy_path: Path

    @classmethod
    def from_env(cls) -> "ServerConfig":
        root = _repo_root()
        models_root = root / "backend" / "models" / "movenet"
        hand_root = root / "backend" / "models" / "hand"
        pose_root = root / "backend" / "models" / "pose"
        return cls(
            host=os.getenv("KGM_WS_HOST", "0.0.0.0"),
            port=int(os.getenv("KGM_WS_PORT", "8765")),
            stream_port=int(os.getenv("KGM_STREAM_PORT", "8090")),
            default_camera_source=_parse_camera_source(os.getenv("KGM_CAMERA_SOURCE", "0")),
            target_fps=max(1, int(os.getenv("KGM_TARGET_FPS", "15"))),
            movenet_lightning_path=Path(
                os.getenv(
                    "KGM_MOVENET_LIGHTNING_PATH",
                    str(models_root / "movenet_lightning_int8.tflite"),
                ),
            ),
            movenet_thunder_path=Path(
                os.getenv(
                    "KGM_MOVENET_THUNDER_PATH",
                    str(models_root / "movenet_thunder_int8.tflite"),
                ),
            ),
            hand_landmarker_path=Path(
                os.getenv(
                    "KGM_HAND_LANDMARKER_PATH",
                    str(hand_root / "hand_landmarker.task"),
                ),
            ),
            pose_landmarker_lite_path=Path(
                os.getenv(
                    "KGM_POSE_LANDMARKER_LITE_PATH",
                    str(pose_root / "pose_landmarker_lite.task"),
                ),
            ),
            pose_landmarker_full_path=Path(
                os.getenv(
                    "KGM_POSE_LANDMARKER_FULL_PATH",
                    str(pose_root / "pose_landmarker_full.task"),
                ),
            ),
            pose_landmarker_heavy_path=Path(
                os.getenv(
                    "KGM_POSE_LANDMARKER_HEAVY_PATH",
                    str(pose_root / "pose_landmarker_heavy.task"),
                ),
            ),
        )
