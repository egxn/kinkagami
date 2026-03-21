from __future__ import annotations

import logging
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from kgm_backend.contracts import KeypointPrediction, Prediction
from kgm_backend.keypoints import MEDIAPIPE_POSE_KEYPOINT_NAMES
from kgm_backend.models.base import Frame

log = logging.getLogger("kgm.models.pose")


class MediaPipePoseDetector:
    def __init__(
        self,
        model_path: Path,
        min_detection_confidence: float,
        min_tracking_confidence: float,
    ) -> None:
        log.info("Loading MediaPipe Pose (model=%s)", model_path.name)
        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(
                model_asset_path=str(model_path),
            ),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        self._detector = mp.tasks.vision.PoseLandmarker.create_from_options(options)
        self._t0 = time.monotonic()
        log.info("MediaPipe Pose ready")

    def predict(self, frame_bgr: Frame) -> list[Prediction]:
        height, width, _ = frame_bgr.shape
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=np.ascontiguousarray(frame_rgb),
        )
        timestamp_ms = int((time.monotonic() - self._t0) * 1000)
        result = self._detector.detect_for_video(mp_image, timestamp_ms)
        if not result.pose_landmarks:
            return []

        landmarks = result.pose_landmarks[0]
        keypoints = []
        for name, landmark in zip(
            MEDIAPIPE_POSE_KEYPOINT_NAMES,
            landmarks,
            strict=True,
        ):
            keypoints.append(
                KeypointPrediction(
                    name=name,
                    x=float(landmark.x * width),
                    y=float(landmark.y * height),
                    z=float(landmark.z),
                    score=float(landmark.visibility),
                    visibility=float(landmark.visibility),
                ),
            )

        pose_score = (
            float(sum(point.visibility or 0.0 for point in keypoints) / len(keypoints))
            if keypoints
            else None
        )
        return [Prediction(keypoints=keypoints, score=pose_score)]

    def close(self) -> None:
        self._detector.close()
