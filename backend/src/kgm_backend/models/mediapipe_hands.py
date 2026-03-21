from __future__ import annotations

import logging
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from kgm_backend.contracts import KeypointPrediction, Prediction
from kgm_backend.keypoints import MEDIAPIPE_HAND_KEYPOINT_NAMES
from kgm_backend.models.base import Frame

log = logging.getLogger("kgm.models.hands")


class MediaPipeHandsDetector:
    def __init__(
        self,
        model_path: Path,
        min_detection_confidence: float,
        min_tracking_confidence: float,
        max_hands: int,
    ) -> None:
        log.info(
            "Loading MediaPipe Hands (model=%s, max_hands=%d)",
            model_path.name,
            max_hands,
        )
        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(
                model_asset_path=str(model_path),
            ),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_hands=max_hands,
            min_hand_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self._detector = mp.tasks.vision.HandLandmarker.create_from_options(options)
        self._t0 = time.monotonic()
        log.info("MediaPipe Hands ready")

    def predict(self, frame_bgr: Frame) -> list[Prediction]:
        height, width, _ = frame_bgr.shape
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=np.ascontiguousarray(frame_rgb),
        )
        timestamp_ms = int((time.monotonic() - self._t0) * 1000)
        result = self._detector.detect_for_video(mp_image, timestamp_ms)
        if not result.hand_landmarks:
            return []

        predictions: list[Prediction] = []
        for index, landmarks in enumerate(result.hand_landmarks):
            label = None
            score = None
            if index < len(result.handedness):
                category = result.handedness[index][0]
                label = category.category_name
                score = category.score

            keypoints = []
            for name, landmark in zip(
                MEDIAPIPE_HAND_KEYPOINT_NAMES,
                landmarks,
                strict=True,
            ):
                keypoints.append(
                    KeypointPrediction(
                        name=name,
                        x=float(landmark.x * width),
                        y=float(landmark.y * height),
                        z=float(landmark.z),
                    ),
                )

            predictions.append(Prediction(keypoints=keypoints, score=score, label=label))

        return predictions

    def close(self) -> None:
        self._detector.close()
