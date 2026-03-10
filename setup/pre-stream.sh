#!/usr/bin/env bash

ffmpeg \
-f v4l2 \
-input_format mjpeg \
-video_size 320x240 \
-framerate 20 \
-i /dev/video0 \
-f mjpeg \
-listen 1 \
http://0.0.0.0:8090/feed