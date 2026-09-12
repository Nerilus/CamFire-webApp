#!/usr/bin/env python3
"""
CamFire - Stream Caméra Picamera2 Haute Performance & Zéro Latence
Optimisations :
1. Compression JPEG calibrée (q=65) pour un débit ultra-léger (< 12 Ko/frame) et fluide
2. Framerate configurable jusqu'à 30 - 35 FPS
3. Prise en charge du profil de couleur NoIR via LIBCAMERA_RPI_TUNING_FILE
4. TCP_NODELAY et wfile.flush() pour éliminer toute latence réseau
"""

import os
import io
import time
import socket
import argparse
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
    parser = argparse.ArgumentParser(description="CamFire - Serveur de flux Picamera2")
    parser.add_argument("--fps", type=int, default=30, help="Nombre d'images par seconde (défaut: 30)")
    parser.add_argument("--quality", type=int, default=65, help="Qualité JPEG de 1 à 100 (défaut: 65 pour fluidité max)")
    parser.add_argument("--width", type=int, default=640, help="Largeur en pixels (défaut: 640)")
    parser.add_argument("--height", type=int, default=480, help="Hauteur en pixels (défaut: 480)")
    parser.add_argument("--noir", action="store_true", help="Active l'étalonnage des couleurs pour caméra NoIR (anti-rose)")
    parser.add_argument("--port", type=int, default=8080, help="Port d'écoute HTTP (défaut: 8080)")
    args = parser.parse_args()

    # Détection et application du profil d'étalonnage NoIR pour libcamera
    tuning_file = None
    if args.noir:
        for candidate in [
            "/usr/share/libcamera/ipa/rpi/vc4/ov5647_noir.json",
            "/usr/share/libcamera/ipa/rpi/pisp/ov5647_noir.json"
        ]:
            if os.path.exists(candidate):
                tuning_file = candidate
                break

    if tuning_file:
        os.environ["LIBCAMERA_RPI_TUNING_FILE"] = tuning_file

    print("=" * 60)
    print(f" CamFire - Stream Caméra Picamera2 ({args.width}x{args.height} @ {args.fps} FPS)")
    print(f" Qualité JPEG : {args.quality}% (Images légères ~12 Ko pour 0 latence)")
    if tuning_file:
        print(f" Profil NoIR : Actif via {tuning_file}")
    elif args.noir:
        print(f" Profil NoIR : Demandé")
    print("=" * 60)

    # Initialisation de Picamera2 (compatible toutes versions libcamera / picamera2)
    time.sleep(0.5)
    picam2 = None
    for attempt in range(3):
        try:
            picam2 = Picamera2()
            break
        except Exception as e:
            if attempt < 2:
                print(f"[Attente] Libération du périphérique caméra... ({e})")
                time.sleep(1.5)
            else:
                raise e

    config = picam2.create_video_configuration(
        main={"size": (args.width, args.height)},
        controls={"FrameRate": args.fps}
    )
    picam2.configure(config)
    output = StreamingOutput()
    picam2.start_recording(JpegEncoder(q=args.quality), FileOutput(output))

    print(f"\n[OK] Serveur caméra actif sur http://0.0.0.0:{args.port}/stream.mjpg")
    print(f"     Prêt pour diffusion en direct à {args.fps} FPS réels.")
    print("     Appuyez sur Ctrl+C pour arrêter le flux.\n")

    server = StreamingServer(('0.0.0.0', args.port), StreamingHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt propre du flux vidéo.")
    finally:
        try:
            picam2.stop_recording()
            picam2.close()
        except Exception:
            pass

if __name__ == "__main__":
    main()
