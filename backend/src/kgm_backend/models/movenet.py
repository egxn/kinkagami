from __future__ import annotations

import logging
from pathlib import Path

import cv2
import numpy as np

from kgm_backend.contracts import KeypointPrediction, Prediction
from kgm_backend.keypoints import MOVENET_KEYPOINT_NAMES
from kgm_backend.models.base import Frame

log = logging.getLogger("kgm.models.movenet")

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:  # pragma: no cover
    try:
        from tflite_runtime.interpreter import Interpreter  # type: ignore[no-redef]
    except ImportError:  # pragma: no cover
        try:
            from tensorflow.lite import Interpreter  # type: ignore[no-redef]
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "No TFLite interpreter available. Install ai-edge-litert, tflite-runtime, or TensorFlow."
            ) from exc


class MoveNetDetector:
    def __init__(self, model_path: Path) -> None:
        if not model_path.exists():
            raise FileNotFoundError(f"MoveNet model file not found: {model_path}")

        log.info("Loading TFLite model from %s", model_path)
        self._interpreter = Interpreter(model_path=str(model_path))
        self._interpreter.allocate_tensors()
        self._input_details = self._interpreter.get_input_details()
        self._output_details = self._interpreter.get_output_details()
        self._input_index = int(self._input_details[0]["index"])
        self._output_index = int(self._output_details[0]["index"])
        input_shape = self._input_details[0]["shape"]
        self._input_height = int(input_shape[1])
        self._input_width = int(input_shape[2])
        self._input_dtype = self._input_details[0]["dtype"]
        log.info(
            "MoveNet ready — input %dx%d dtype=%s",
            self._input_width,
            self._input_height,
            self._input_dtype.__name__,
        )

    def _prepare_input(self, frame_bgr: Frame) -> np.ndarray:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (self._input_width, self._input_height))
        tensor = np.expand_dims(resized.astype(self._input_dtype), axis=0)
        return tensor

    def predict(self, frame_bgr: Frame) -> list[Prediction]:
        height, width, _ = frame_bgr.shape
        input_tensor = self._prepare_input(frame_bgr)
        self._interpreter.set_tensor(self._input_index, input_tensor)
        self._interpreter.invoke()
        raw_output = self._interpreter.get_tensor(self._output_index)

        keypoints_data = raw_output[0][0]
        keypoints = [
            KeypointPrediction(
                name=name,
                x=float(point[1] * width),
                y=float(point[0] * height),
                score=float(point[2]),
            )
            for name, point in zip(MOVENET_KEYPOINT_NAMES, keypoints_data, strict=True)
        ]

        pose_score = (
            float(sum(point.score or 0.0 for point in keypoints) / len(keypoints))
            if keypoints
            else None
        )
        return [Prediction(keypoints=keypoints, score=pose_score)]

    def close(self) -> None:
        return None
