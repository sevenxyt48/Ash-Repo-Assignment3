"""Serve Word Paths and proxy its fixed vocabulary source endpoints."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import Request, urlopen
import json
import mimetypes
import os

from source_apis import (
    SourceApiError,
    clean_term,
    enrich_krdict_word,
    enrich_wiktionary_word,
    load_words,
    matching_korean_words,
    request_krdict,
)


ROOT = Path(__file__).resolve().parent
SUPPORTED_LANGUAGES = {"zh", "ja", "en", "ko"}
REQUEST_TIMEOUT_SECONDS = 15
MAX_POST_BYTES = 16 * 1024


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
        if request.path == "/api/krdict/search":
            self.search_krdict(request.query)
            return
        self.serve_static(request.path)

    def do_POST(self):
        request = urlsplit(self.path)
        if request.path not in {"/api/krdict/enrich", "/api/wiktionary/enrich"}:
            self.send_json_error(404, "Not found")
            return
        try:
            body_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json_error(400, "Invalid request length")
            return
        if body_length <= 0 or body_length > MAX_POST_BYTES:
            self.send_json_error(413, "Request body is empty or too large")
            return
        try:
            payload = json.loads(self.rfile.read(body_length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json_error(400, "Request body must be valid JSON")
            return
        if not isinstance(payload, dict) or not isinstance(payload.get("wordId"), str):
            self.send_json_error(400, "A wordId is required")
            return
        try:
            result = (
                enrich_krdict_word(payload["wordId"])
                if request.path == "/api/krdict/enrich"
                else enrich_wiktionary_word(payload["wordId"])
            )
            self.send_json(200, result)
        except SourceApiError as error:
            self.send_json_error(error.status, str(error))

    def search_krdict(self, query):
        parameters = parse_qs(query, keep_blank_values=True)
        try:
            term = clean_term(parameters.get("word", [""])[0])
            result = request_krdict(term)
            existing_words = matching_korean_words(term, load_words())
            result["matchedWordIds"] = [word["id"] for word in existing_words]
            self.send_json(200, result)
        except SourceApiError as error:
            self.send_json_error(error.status, str(error))

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_bytes(status, "application/json; charset=utf-8", body)

    def serve_static(self, request_path):
        relative_path = unquote(request_path).lstrip("/") or "index.html"
        file_path = (ROOT / relative_path).resolve()
        try:
            resolved_relative = file_path.relative_to(ROOT)
        except ValueError:
            self.send_json_error(404, "Not found")
            return
        if any(part == ".env" or part.startswith(".env.") for part in resolved_relative.parts):
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
    port = int(os.environ.get("WORDPATHS_PORT", "8000"))
    address = ("127.0.0.1", port)
    print(f"Word Paths available at http://{address[0]}:{address[1]}/")
    ThreadingHTTPServer(address, WordPathsHandler).serve_forever()
