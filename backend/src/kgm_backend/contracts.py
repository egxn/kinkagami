from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal, TypeAlias

MoveNetVersion: TypeAlias = Literal["lightning", "thunder"]
BlazePoseVersion: TypeAlias = Literal["lite", "full", "heavy"]
HandPoseVersion: TypeAlias = Literal["lite", "full"]
ModelType: TypeAlias = Literal["movenet", "blazepose", "handpose"]
ModelVersion: TypeAlias = MoveNetVersion | BlazePoseVersion | HandPoseVersion
CameraSource: TypeAlias = int | str


@dataclass(slots=True)
class ActiveModel:
    type: ModelType
    version: ModelVersion
    name: str


@dataclass(slots=True)
class KeypointPrediction:
    x: float
    y: float
    score: float | None = None
    name: str | None = None
    z: float | None = None
    visibility: float | None = None


@dataclass(slots=True)
class Prediction:
    keypoints: list[KeypointPrediction]
    score: float | None = None
    label: str | None = None


@dataclass(slots=True)
class ImageSize:
    width: int
    height: int


@dataclass(slots=True)
class ResultMessage:
    type: Literal["result"] = "result"
    timestamp: int = 0
    activeModel: ActiveModel | None = None
    imageSize: ImageSize | None = None
    predictions: list[Prediction] = field(default_factory=list)

    def to_payload(self) -> dict[str, object]:
        return asdict(self)


@dataclass(slots=True)
class ReadyMessage:
    activeModel: ActiveModel
    type: Literal["ready"] = "ready"

    def to_payload(self) -> dict[str, object]:
        return asdict(self)


@dataclass(slots=True)
class StatusMessage:
    running: bool
    activeModel: ActiveModel | None
    cameraSource: CameraSource | None
    type: Literal["status"] = "status"

    def to_payload(self) -> dict[str, object]:
        return asdict(self)


@dataclass(slots=True)
class ErrorMessage:
    error: str
    type: Literal["error"] = "error"

    def to_payload(self) -> dict[str, object]:
        return asdict(self)


@dataclass(slots=True)
class StartRequest:
    model_type: ModelType
    version: ModelVersion
    camera_source: CameraSource
    width: int | None
    height: int | None
    fps: int | None
    min_detection_confidence: float
    min_tracking_confidence: float
    max_hands: int


@dataclass(slots=True)
class StopRequest:
    pass


@dataclass(slots=True)
class GetStatusRequest:
    pass
