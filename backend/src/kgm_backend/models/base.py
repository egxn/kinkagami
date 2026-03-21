from __future__ import annotations

from typing import Protocol

import numpy as np
from numpy.typing import NDArray

from kgm_backend.contracts import Prediction

Frame = NDArray[np.uint8]


class Detector(Protocol):
    def predict(self, frame_bgr: Frame) -> list[Prediction]:
        ...

    def close(self) -> None:
        ...
