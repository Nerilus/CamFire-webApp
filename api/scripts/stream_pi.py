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

picam2 = None
active_controls = {}

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
    def do_HEAD(self):
        if self.path in ('/', '/stream.mjpg'):
            self.send_response(200)
            self.send_header('Age', '0')
            self.send_header('Cache-Control', 'no-cache, private')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=FRAME')
            self.end_headers()
        elif self.path.startswith('/control'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
        else:
            self.send_error(404)
            self.end_headers()

    def do_GET(self):
        global picam2, active_controls
        if self.path == '/':
            self.send_response(301)
            self.send_header('Location', '/stream.mjpg')
            self.end_headers()
        elif self.path.startswith('/control'):
            import urllib.parse
            import json
            parsed = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(parsed.query)
            updates = {}
            if 'red' in params and 'blue' in params:
                try:
                    r = float(params['red'][0])
                    b = float(params['blue'][0])
                    updates["AwbEnable"] = False
                    updates["ColourGains"] = (r, b)
                except Exception:
                    pass
            elif 'awb' in params:
                awb_name = params['awb'][0].lower()
                awb_dict = {
                    "auto": 0, "incandescent": 1, "tungsten": 2,
                    "fluorescent": 3, "indoor": 4, "daylight": 5, "cloudy": 6
                }
                if awb_name in awb_dict:
                    updates["AwbEnable"] = True
                    updates["AwbMode"] = awb_dict[awb_name]
            if 'saturation' in params:
                try:
                    updates["Saturation"] = float(params['saturation'][0])
                except Exception:
                    pass

            applied = {}
            if picam2 and updates:
                try:
                    picam2.set_controls(updates)
                    active_controls.update(updates)
                    applied = updates
                    print(f"[Contrôles Caméra] Nouveaux réglages appliqués : {updates}")
                except Exception as e:
                    print(f"[Contrôles Caméra] Erreur application réglages : {e}")

            resp_data = json.dumps({
                "status": "ok",
                "applied": applied,
                "current": {k: (list(v) if isinstance(v, tuple) else v) for k, v in active_controls.items()}
            }).encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp_data)))
            self.end_headers()
            self.wfile.write(resp_data)
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
    global output, picam2, active_controls
    parser = argparse.ArgumentParser(description="CamFire - Serveur de flux Picamera2")
    parser.add_argument("--fps", type=int, default=30, help="Nombre d'images par seconde (défaut: 30)")
    parser.add_argument("--quality", type=int, default=65, help="Qualité JPEG de 1 à 100 (défaut: 65 pour fluidité max)")
    parser.add_argument("--width", type=int, default=640, help="Largeur en pixels (défaut: 640)")
    parser.add_argument("--height", type=int, default=480, help="Hauteur en pixels (défaut: 480)")
    parser.add_argument("--noir", action="store_true", default=True, help="Active l'étalonnage des couleurs pour caméra NoIR")
    parser.add_argument("--awb", default="indoor", choices=["auto", "incandescent", "tungsten", "indoor", "daylight", "cloudy"], help="Mode de balance des blancs (défaut: indoor pour neutraliser le rose NoIR)")
    parser.add_argument("--red-gain", type=float, default=None, help="Gain manuel rouge (optionnel)")
    parser.add_argument("--blue-gain", type=float, default=None, help="Gain manuel bleu (optionnel)")
    parser.add_argument("--saturation", type=float, default=0.85, help="Saturation des couleurs (défaut: 0.85 pour atténuer la dominante NoIR)")
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

    # Configuration des contrôles matériels (AwbMode, Saturation, ou ColourGains)
    controls_map = {"FrameRate": args.fps}
    if args.saturation is not None:
        controls_map["Saturation"] = args.saturation

    if args.red_gain is not None and args.blue_gain is not None:
        controls_map["AwbEnable"] = False
        controls_map["ColourGains"] = (args.red_gain, args.blue_gain)
        print(f"    • Gains manuels appliqués : Rouge={args.red_gain}, Bleu={args.blue_gain}")
    elif args.awb and args.awb != "auto":
        awb_dict = {
            "auto": 0,
            "incandescent": 1,
            "tungsten": 2,
            "fluorescent": 3,
            "indoor": 4,
            "daylight": 5,
            "cloudy": 6
        }
        mode_val = awb_dict.get(args.awb, 4)
        controls_map["AwbEnable"] = True
        controls_map["AwbMode"] = mode_val
        print(f"    • Balance des blancs dynamique : {args.awb} (mode {mode_val}, réduction du rose)")
    else:
        controls_map["AwbEnable"] = True
        controls_map["AwbMode"] = 0
        print(f"    • Balance des blancs : Auto")

    active_controls = dict(controls_map)

    config = picam2.create_video_configuration(
        main={"size": (args.width, args.height)},
        controls=controls_map
    )
    picam2.configure(config)
    output = StreamingOutput()
    picam2.start_recording(JpegEncoder(q=args.quality), FileOutput(output))

    try:
        picam2.set_controls(controls_map)
    except Exception:
        pass

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
