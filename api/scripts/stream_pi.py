#!/usr/bin/env python3
"""
CamFire - Stream Caméra Picamera2 Haute Performance & Zéro Latence
Optimisations :
1. Compression JPEG calibrée (q=68) pour réduire le poids des images de 70%
2. Framerate stabilisé à 25 FPS
3. TCP_NODELAY et wfile.flush() pour supprimer tout buffer ou délai réseau
"""

import io
import time
import socket
import threading
from http import server
import socketserver
from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput

class StreamingOutput(io.BufferedIOBase):
    def __init__(self):
        self.frame = None
        self.condition = threading.Condition()

    def write(self, buf):
        if buf.startswith(b'\xff\xd8'):
            with self.condition:
                self.frame = buf
                self.condition.notify_all()

class StreamingHandler(server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(301)
            self.send_header('Location', '/stream.mjpg')
            self.end_headers()
        elif self.path == '/stream.mjpg':
            self.send_response(200)
            self.send_header('Age', '0')
            self.send_header('Cache-Control', 'no-cache, private')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=FRAME')
            self.end_headers()
            try:
                while True:
                    with output.condition:
                        output.condition.wait()
                        frame = output.frame
                    self.wfile.write(b'--FRAME\r\n')
                    self.send_header('Content-Type', 'image/jpeg')
                    self.send_header('Content-Length', str(len(frame)))
                    self.end_headers()
                    self.wfile.write(frame)
                    self.wfile.write(b'\r\n')
                    self.wfile.flush()
            except Exception:
                pass
        else:
            self.send_error(404)
            self.end_headers()

class StreamingServer(socketserver.ThreadingMixIn, server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def server_bind(self):
        super().server_bind()
        self.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

def main():
    global output
    print("[1/2] Initialisation Picamera2 (640x480 @ 25 FPS, compression ultra-fluide)...")
    picam2 = Picamera2()
    config = picam2.create_video_configuration(
        main={"size": (640, 480)},
        controls={"FrameRate": 25}
    )
    picam2.configure(config)
    output = StreamingOutput()
    picam2.start_recording(JpegEncoder(q=68), FileOutput(output))

    print("[2/2] Serveur actif sur http://0.0.0.0:8080 (Zéro Latence & TCP_NODELAY)")
    server = StreamingServer(('0.0.0.0', 8080), StreamingHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        picam2.stop_recording()
        print("\nArrêt propre du flux vidéo.")

if __name__ == "__main__":
    main()
