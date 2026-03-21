"""Lightweight MJPEG-over-HTTP server.

Reads frames from a shared queue filled by the inference loop and serves
them as a multipart MJPEG stream on ``/stream``.  This lets the frontend
display the camera feed without grabbing the device itself.
"""

from __future__ import annotations

import asyncio
import logging
from asyncio import Queue
from typing import Any

from aiohttp import web

log = logging.getLogger("kgm.stream")

_BOUNDARY = b"kgmframe"


class MjpegStreamServer:
    """Manages an aiohttp server that exposes a ``/stream`` endpoint."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8090) -> None:
        self._host = host
        self._port = port
        self._subscribers: set[Queue[bytes]] = set()
        self._runner: web.AppRunner | None = None
        self._latest_frame: bytes | None = None

    # -- public API ----------------------------------------------------------

    async def start(self) -> None:
        app = web.Application()
        app.router.add_get("/stream", self._handle_stream)
        app.router.add_get("/snapshot", self._handle_snapshot)
        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, self._host, self._port)
        await site.start()
        log.info("MJPEG stream serving on http://%s:%d/stream", self._host, self._port)

    async def stop(self) -> None:
        if self._runner:
            log.info("Stopping MJPEG stream server")
            await self._runner.cleanup()
            self._runner = None

    def push_frame(self, jpeg_bytes: bytes) -> None:
        """Enqueue a JPEG frame to all connected viewers."""
        self._latest_frame = jpeg_bytes
        stale: list[Queue[bytes]] = []
        for queue in self._subscribers:
            try:
                # Drop old frames if the viewer is slow.
                while not queue.empty():
                    queue.get_nowait()
                queue.put_nowait(jpeg_bytes)
            except asyncio.QueueFull:
                stale.append(queue)
        for q in stale:
            self._subscribers.discard(q)

    # -- request handler -----------------------------------------------------

    async def _handle_stream(self, _request: web.Request) -> web.StreamResponse:
        response = web.StreamResponse(
            status=200,
            headers={
                "Content-Type": f"multipart/x-mixed-replace; boundary={_BOUNDARY.decode()}",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Access-Control-Allow-Origin": "*",
            },
        )
        await response.prepare(_request)

        queue: Queue[bytes] = Queue(maxsize=2)
        self._subscribers.add(queue)
        log.info("MJPEG viewer connected (total: %d)", len(self._subscribers))
        try:
            while True:
                jpeg = await queue.get()
                await response.write(
                    b"--" + _BOUNDARY + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                    + jpeg + b"\r\n"
                )
        except (ConnectionResetError, asyncio.CancelledError):
            pass
        finally:
            self._subscribers.discard(queue)
            log.info("MJPEG viewer disconnected (total: %d)", len(self._subscribers))

        return response

    async def _handle_snapshot(self, _request: web.Request) -> web.Response:
        """Return the latest JPEG frame as a single image response."""
        frame = self._latest_frame
        if frame is None:
            return web.Response(status=503, text="No frame available yet")
        return web.Response(
            body=frame,
            content_type="image/jpeg",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Access-Control-Allow-Origin": "*",
            },
        )
