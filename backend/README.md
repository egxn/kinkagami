# Python Camera Backend

Isolated backend to capture camera with OpenCV and expose inference via WebSocket.

Supported models:

- `movenet` with TFLite (`lightning` or `thunder`)
- `blazepose` with `mediapipe` (`lite`, `full`, `heavy`)
- `handpose` with `mediapipe` (`lite`, `full`)

Only one model runs at a time. Each result message reports the active model and detected keypoints.

The frontend can start in two offline modes:

- `pnpm dev:frontend`: local browser inference (`workers`)
- `pnpm dev:python`: Vite frontend + Python backend via local WebSocket

## Requirements

- Python 3.11+
- Poetry
- MoveNet TFLite model file

Default expected paths for MoveNet:

- `backend/models/movenet/movenet_lightning_int8.tflite`
- `backend/models/movenet/movenet_thunder_int8.tflite`

You can override them with environment variables:

```bash
export KGM_MOVENET_LIGHTNING_PATH=/path/to/model/lightning.tflite
export KGM_MOVENET_THUNDER_PATH=/path/to/model/thunder.tflite
```

## Installation

```bash
cd python_backend
poetry install
```

## Run

```bash
poetry run kgm-camera-backend --host 0.0.0.0 --port 8765
```

Optional variables:

- `KGM_CAMERA_SOURCE`: camera index (`0`) or RTSP/HTTP URL.
- `KGM_TARGET_FPS`: result emission rate.

## WebSocket Protocol

### Requests

Start or switch the active model:

```json
{
  "type": "start",
  "model": {
    "type": "movenet",
    "version": "lightning"
  },
  "camera": {
    "source": 0,
    "width": 1280,
    "height": 720,
    "fps": 30
  },
  "options": {
    "min_detection_confidence": 0.5,
    "min_tracking_confidence": 0.5,
    "max_hands": 2
  }
}
```

Query status:

```json
{ "type": "get_status" }
```

Stop inference:

```json
{ "type": "stop" }
```

### Response Events

Server status:

```json
{
  "type": "status",
  "running": true,
  "activeModel": {
    "type": "blazepose",
    "version": "full",
    "name": "MediaPipe Pose Landmark Full"
  }
}
```

Server ready after loading the model:

```json
{
  "type": "ready",
  "activeModel": {
    "type": "handpose",
    "version": "lite",
    "name": "MediaPipe Hand Landmark Lite"
  }
}
```

Inference results:

```json
{
  "type": "result",
  "timestamp": 1742430100123,
  "activeModel": {
    "type": "movenet",
    "version": "lightning",
    "name": "MoveNet SinglePose Lightning"
  },
  "imageSize": {
    "width": 1280,
    "height": 720
  },
  "predictions": [
    {
      "score": 0.94,
      "keypoints": [
        {
          "name": "nose",
          "x": 640.12,
          "y": 132.44,
          "score": 0.98
        }
      ]
    }
  ]
}
```

Errors:

```json
{
  "type": "error",
  "error": "MoveNet model file not found"
}
```
