"""Serve Word Paths and proxy its fixed ConceptNet lookup endpoint."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import Request, urlopen
import json
import mimetypes


ROOT = Path(__file__).resolve().parent
SUPPORTED_LANGUAGES = {"zh", "ja", "en", "ko"}
REQUEST_TIMEOUT_SECONDS = 15


class WordPathsHandler(BaseHTTPRequestHandler):
    def send_bytes(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, status, message):
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_bytes(status, "application/json; charset=utf-8", body)

    def do_GET(self):
        request = urlsplit(self.path)
        if request.path == "/api/conceptnet":
            self.proxy_conceptnet(request.query)
            return

        relative_path = unquote(request.path).lstrip("/") or "index.html"
        file_path = (ROOT / relative_path).resolve()
        try:
            file_path.relative_to(ROOT)
        except ValueError:
            self.send_json_error(404, "Not found")
            return
        if not file_path.is_file():
            self.send_json_error(404, "Not found")
            return

        content_type, _ = mimetypes.guess_type(file_path.name)
        body = file_path.read_bytes()
        self.send_bytes(
            200,
            f"{content_type or 'application/octet-stream'}; charset=utf-8",
            body,
        )

    def proxy_conceptnet(self, query):
        parameters = parse_qs(query, keep_blank_values=True)
        language = parameters.get("language", [""])[0]
        term = parameters.get("term", [""])[0].strip()
        if language not in SUPPORTED_LANGUAGES or not term:
            self.send_json_error(400, "A supported language and non-empty term are required")
            return
        if len(term.encode("utf-8")) > 500:
            self.send_json_error(400, "The search term is too long")
            return

        encoded_term = quote(term, safe="")
        upstream = f"https://api.conceptnet.io/c/{language}/{encoded_term}?limit=100"
        request = Request(upstream, headers={"User-Agent": "WordPaths/1.0"})
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                body = response.read()
                self.send_bytes(response.status, "application/json; charset=utf-8", body)
        except HTTPError as error:
            self.send_bytes(error.code, "application/json; charset=utf-8", error.read())
        except (URLError, TimeoutError) as error:
            print(f"ConceptNet proxy request failed: {error}")
            self.send_json_error(502, "ConceptNet is temporarily unavailable")


if __name__ == "__main__":
    address = ("127.0.0.1", 8000)
    print(f"Word Paths available at http://{address[0]}:{address[1]}/")
    ThreadingHTTPServer(address, WordPathsHandler).serve_forever()
