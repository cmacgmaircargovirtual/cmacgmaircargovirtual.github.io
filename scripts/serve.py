"""Local preview of the site, without browser cache.

Usage:  python scripts/serve.py          -> http://localhost:8080
        python scripts/serve.py 8090     -> another port

Unlike `python -m http.server`, every answer says "Cache-Control: no-store": a plain refresh (F5) always
shows the latest CSS and images, even when an image keeps the same file name (hero-desktop.jpg...).
Ctrl+C stops it. Only for testing on your computer: GitHub Pages serves the real site.
"""
import contextlib
import functools
import http.server
import os
import socket
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # Answers on IPv6 and IPv4 (browsers try "localhost" as ::1 first).
    address_family = socket.AF_INET6
    # On Windows, address reuse lets a second server start silently on a port already taken,
    # and the browser then gets one or the other. Without it, a second start fails clearly.
    allow_reuse_address = sys.platform != "win32"

    def server_bind(self) -> None:
        with contextlib.suppress(Exception):
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


def main() -> None:
    # Port: the argument, else the PORT variable (set by tools that pick a free port), else 8080.
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8080))
    handler = functools.partial(NoCacheHandler, directory=str(SITE))
    try:
        server = Server(("::", port), handler)
    except OSError:
        sys.exit(f"Port {port} is already in use: stop the other server (Ctrl+C in its window) or pick another port.")
    print(f"Site preview on http://localhost:{port}  (no browser cache, Ctrl+C to stop)")
    with server:
        with contextlib.suppress(KeyboardInterrupt):
            server.serve_forever()


if __name__ == "__main__":
    main()
