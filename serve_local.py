#!/usr/bin/env python3
"""Serve the site and the sibling HTML games folder on one local origin."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import mimetypes
import os
import webbrowser


SITE_ROOT = Path(__file__).resolve().parent
GAME_ROOT = SITE_ROOT.parent / "HTML games" / "UGS Files"


class GameSiteHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        request_path = unquote(urlsplit(path).path)
        if request_path.startswith("/games/"):
            candidate = (GAME_ROOT / request_path[len("/games/"):]).resolve()
            try:
                candidate.relative_to(GAME_ROOT.resolve())
            except ValueError:
                return str(GAME_ROOT / "__not_found__")
            return str(candidate)

        relative = request_path.lstrip("/") or "index.html"
        candidate = (SITE_ROOT / relative).resolve()
        try:
            candidate.relative_to(SITE_ROOT)
        except ValueError:
            return str(SITE_ROOT / "__not_found__")
        return str(candidate)

    def end_headers(self):
        if urlsplit(self.path).path in ("/", "/index.html", "/game-host-config.js"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if not Path(path).is_file():
            self.send_error(404, "File not found")
            return None

        if urlsplit(self.path).path.startswith("/games/") and urlsplit(self.path).query == "download=1":
            file_path = Path(path)
            try:
                stream = file_path.open("rb")
            except OSError:
                self.send_error(404, "File not found")
                return None
            filename = file_path.name.replace('"', "")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(file_path.stat().st_size))
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.end_headers()
            return stream

        return super().send_head()

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path.startswith("/games/") and parsed.query == "clean=1":
            target = parsed.path.replace('"', "%22")
            page = f'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AGU Games</title><style>html,body,iframe{{width:100%;height:100%;margin:0;border:0;overflow:hidden;background:#111}}iframe{{display:block}}</style></head><body><iframe id="game" allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture" src="{target}"></iframe><script>
const selectors='#sidebarad1,#sidebarad2,#ad-container,#ad-banner,#advertisement,.sidebar-close,.ad-container,.ad-wrapper,.ad-banner,.ad-slot,.ad-placement,.advertisement,.advertisement-container,.adsbygoogle,[data-ad-slot],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="googleadservices"],script[src*="googlesyndication"],script[src*="doubleclick"],script[src*="adsystem"],script[src*="adservice"],script[src*="googleadservices"]';
const frame=document.getElementById('game');
function clean(){{try{{const doc=frame.contentDocument;if(!doc)return;doc.querySelectorAll(selectors).forEach(node=>node.remove());doc.querySelectorAll('[id],[class]').forEach(node=>{{const names=(node.id||'')+' '+(typeof node.className==='string'?node.className:'');if(/(^|\\s)(?:ad|ads|advert|advertisement|adslot|ad-slot|adcontainer|ad-container|ad-wrapper|ad-banner)(?:$|[-_\\s\\d])/i.test(names))node.remove();}});}}catch{{}}}}
frame.addEventListener('load',()=>{{clean();try{{const observer=new frame.contentWindow.MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(node=>{{if(node.nodeType!==1)return;if(node.matches(selectors))node.remove();else node.querySelectorAll(selectors).forEach(el=>el.remove());}})));observer.observe(frame.contentDocument.documentElement,{{childList:true,subtree:true}});}}catch{{}}}});
</script></body></html>'''.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(page)
            return
        super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Bind address (default: loopback only)")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically")
    args = parser.parse_args()

    if not GAME_ROOT.is_dir():
        raise SystemExit(f"Game folder not found: {GAME_ROOT}\nPut the site beside 'HTML games/UGS Files'.")

    server = ThreadingHTTPServer((args.host, args.port), GameSiteHandler)
    address = f"http://{args.host}:{args.port}/"
    print(f"AGU Games is running at {address}")
    print(f"Serving local games from {GAME_ROOT}")
    print("Press Ctrl+C to stop the server.")
    if not args.no_open:
        webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping AGU Games server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
