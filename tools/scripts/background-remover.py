"""Background removal for AgeStyles AI Studio (AG-27).

Loads one rembg model once and serves POST /remove (image bytes in, PNG with transparency
out) and GET /health on 127.0.0.1 only. Requests are handled one at a time so memory stays
bounded on the shared VPS.
"""

import io
import os
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

from PIL import Image
from rembg import new_session, remove

MAX_BYTES = 8 * 1024 * 1024
MAX_EDGE = 2048
started = time.time()
session = new_session(os.environ.get("MODEL", "isnet-general-use"))
print(f"model ready in {time.time() - started:.1f}s", flush=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # keep logs short: no request lines with paths
        pass

    def do_GET(self):
        self.send_response(200 if self.path == "/health" else 404)
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        if self.path != "/remove" or length <= 0 or length > MAX_BYTES:
            self.send_response(400)
            self.end_headers()
            return
        try:
            image = Image.open(io.BytesIO(self.rfile.read(length)))
            image.thumbnail((MAX_EDGE, MAX_EDGE))
            output = io.BytesIO()
            remove(image, session=session).save(output, "PNG", optimize=True)
            body = output.getvalue()
        except Exception as error:  # invalid image or model failure
            print(f"remove failed: {type(error).__name__}", flush=True)
            self.send_response(422)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("content-type", "image/png")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


HTTPServer(("127.0.0.1", int(os.environ.get("PORT", "19089"))), Handler).serve_forever()
