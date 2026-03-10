#!/usr/bin/env bash

./mjpg_streamer \
-i "input_uvc.so -d /dev/video0 -r 320x240 -f 20" \
-o "output_http.so -p 8090 -w ./www"