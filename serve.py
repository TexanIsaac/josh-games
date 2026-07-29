"""Static file server for Joshua's games.

Runs on Mallet (DT-LT21-075) so the iPad can load games over the LAN.

Why not just `python -m http.server`: that sends caching headers, so Safari on
the iPad happily serves a stale copy after Josh changes his code. Refresh then
shows the OLD game and nothing looks broken, which is the most demoralizing
possible bug for a kid. This server sends no-cache on everything, so a refresh
always shows the newest code.
"""

import argparse
import http.server
import socket
import socketserver
from pathlib import Path

ROOT = Path(__file__).parent.resolve()


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the console readable: one short line per request.
        print(f"  {self.address_string()}  {fmt % args}")


class ReusableServer(socketserver.ThreadingTCPServer):
    # Without this, restarting the server within ~2 min fails with "address in use".
    allow_reuse_address = True
    daemon_threads = True


def lan_ip() -> str:
    """Best-effort LAN address. Prefers a real 192.168.x over CGNAT/Tailscale."""
    candidates = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            candidates.append(info[4][0])
    except socket.gaierror:
        pass
    for ip in candidates:
        if ip.startswith("192.168."):
            return ip
    return candidates[0] if candidates else "127.0.0.1"


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve Joshua's games over the LAN.")
    parser.add_argument("--port", type=int, default=8790)
    args = parser.parse_args()

    ip = lan_ip()
    with ReusableServer(("0.0.0.0", args.port), NoCacheHandler) as httpd:
        print()
        print("  Joshua's game server is running.")
        print(f"  Serving: {ROOT}")
        print()
        print(f"  On this computer:  http://localhost:{args.port}/")
        print(f"  On the iPad:       http://{ip}:{args.port}/")
        print()
        print("  Press Ctrl+C to stop.")
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopped.\n")


if __name__ == "__main__":
    main()
