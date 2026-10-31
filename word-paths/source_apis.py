"""Backend-only clients and extractors for KRDict and Chinese Wiktionary."""
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
import json
import os
import re
import threading
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent
WORDS_PATH = ROOT / "data" / "words.json"
CANDIDATES_PATH = ROOT / "data" / "candidate-relationships.json"
KRDICT_ENRICHMENT_PATH = ROOT / "data" / "krdict-enrichment.json"
WIKTIONARY_ENRICHMENT_PATH = ROOT / "data" / "etymology-sources.json"
KRDICT_URL = "https://krdict.korean.go.kr/api/search"
WIKTIONARY_API_URL = "https://zh.wiktionary.org/w/api.php"
WIKTIONARY_USER_AGENT = (
    "WordPaths/1.0 "
    "(https://github.com/sevenxyt48/Ash-Repo-Assignment3; contact: repository issues)"
)
REQUEST_TIMEOUT_SECONDS = 15
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
MAX_QUERY_LENGTH = 100
DATA_WRITE_LOCK = threading.RLock()


class SourceApiError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean_term(value):
    if not isinstance(value, str) or not value.strip():
        raise SourceApiError("A non-empty word is required", 400)
    term = value.strip()
    if len(term.encode("utf-8")) > MAX_QUERY_LENGTH:
        raise SourceApiError("The word is too long", 400)
    return term


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default
    except (OSError, json.JSONDecodeError) as error:
        raise SourceApiError(f"Unable to read local source data: {path.name}", 500) from error


def write_json_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    except OSError as error:
        temporary.unlink(missing_ok=True)
        raise SourceApiError(f"Unable to save local source data: {path.name}", 500) from error


def load_words():
    dataset = read_json(WORDS_PATH, None)
    if not isinstance(dataset, dict) or not isinstance(dataset.get("words"), list):
        raise SourceApiError("The local word dataset is invalid", 500)
    return dataset["words"]


def find_word(word_id, expected_language=None):
    word = next((item for item in load_words() if item.get("id") == word_id), None)
    if not word:
        raise SourceApiError("The requested word ID does not exist", 404)
    if expected_language and word.get("language") != expected_language:
        raise SourceApiError("The requested word has the wrong language", 400)
    return word


def read_key_from_env_file():
    env_path = ROOT / ".env"
    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return
    except OSError as error:
        raise SourceApiError("Unable to read the local .env file", 500) from error

    for line in lines:
        key, separator, value = line.partition("=")
        if separator and key.strip() == "KRDICT_API_KEY":
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            if value:
                os.environ.setdefault("KRDICT_API_KEY", value)
            break


def fetch_url(url, headers=None):
    request = Request(url, headers=headers or {})
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
            if len(body) > MAX_RESPONSE_BYTES:
                raise SourceApiError("The provider response exceeded the size limit", 502)
            return response.status, body
    except HTTPError as error:
        raise SourceApiError(f"Source API returned HTTP {error.code}", 502) from error
    except (URLError, TimeoutError) as error:
        raise SourceApiError("Source API request failed or timed out", 502) from error


def local_name(tag):
    return tag.rsplit("}", 1)[-1]


def node_text(node):
    return "".join(node.itertext()).strip()


def child_text(node, name):
    for child in node.iter():
        if local_name(child.tag) == name:
            return node_text(child)
    return ""


def parse_krdict_xml(payload):
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as error:
        raise SourceApiError("KRDict returned invalid XML", 502) from error

    for error_node in root.iter():
        if local_name(error_node.tag) in {"error", "error_msg", "errorMessage"}:
            message = node_text(error_node)
            if message:
                raise SourceApiError(f"KRDict API error: {message}", 502)

    items = []
    seen_codes = set()
    for node in root.iter():
        if local_name(node.tag) != "item":
            continue
        item = {
            "word": child_text(node, "word"),
            "target_code": child_text(node, "target_code"),
            "sup_no": child_text(node, "sup_no"),
            "origin": child_text(node, "origin"),
            "pronunciation": child_text(node, "pronunciation"),
            "word_grade": child_text(node, "word_grade"),
            "pos": child_text(node, "pos"),
            "link": child_text(node, "link"),
            "definitions": [
                node_text(definition)
                for definition in node.iter()
                if local_name(definition.tag) == "definition" and node_text(definition)
            ],
        }
        item = {key: value for key, value in item.items() if value}
        if not item.get("word"):
            continue
        identity = item.get("target_code") or (
            item["word"], item.get("sup_no", ""), tuple(item.get("definitions", []))
        )
        if identity in seen_codes:
            continue
        seen_codes.add(identity)
        items.append(item)

    total = child_text(root, "total")
    return {"total": total or str(len(items)), "items": items}


def request_krdict(term):
    read_key_from_env_file()
    api_key = os.environ.get("KRDICT_API_KEY", "").strip()
    if not api_key or api_key.lower() in {"your_api_key", "replace_me", "changeme"}:
        raise SourceApiError(
            "KRDICT_API_KEY is not configured in the server environment or word-paths/.env",
            503,
        )
    query = urlencode({
        "key": api_key,
        "q": clean_term(term),
        "part": "word",
        "sort": "popular",
        "num": "20",
        "start": "1",
    })
    _, payload = fetch_url(
        f"{KRDICT_URL}?{query}",
        {"User-Agent": "WordPaths/1.0 (KRDict server-side dictionary lookup)"},
    )
    result = parse_krdict_xml(payload)
    exact = [item for item in result["items"] if item.get("word", "").strip() == term.strip()]
    result["exactItems"] = exact
    result["term"] = term.strip()
    return result


def wiki_title(word):
    return word.get("translations", {}).get(word["language"]) or word["word"]


def fetch_wiktionary_page(title):
    parameters = urlencode({
        "action": "query",
        "prop": "info|revisions",
        "rvprop": "content",
        "rvslots": "main",
        "format": "json",
        "formatversion": "2",
        "redirects": "1",
        "titles": title,
    })
    _, body = fetch_url(
        f"{WIKTIONARY_API_URL}?{parameters}",
        {"User-Agent": WIKTIONARY_USER_AGENT, "Accept": "application/json"},
    )
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SourceApiError("Wiktionary returned invalid JSON", 502) from error
    if payload.get("error"):
        raise SourceApiError("Wiktionary API returned an error", 502)
    pages = payload.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing") is not None:
        return {"requestedTitle": title, "pageTitle": None, "content": None}
    page = pages[0]
    revision = (page.get("revisions") or [{}])[0]
    content = revision.get("slots", {}).get("main", {}).get("content")
    return {
        "requestedTitle": title,
        "pageTitle": page.get("title"),
        "content": content if isinstance(content, str) else None,
    }


LANGUAGE_HEADINGS = {
    "zh": {"汉语", "漢語", "中文", "chinese"},
    "ja": {"日语", "日語", "日本語", "japanese"},
    "ko": {"朝鲜语", "朝鮮語", "韓國語", "한국어", "korean"},
}
ETYMOLOGY_HEADINGS = {
    "字源", "词源", "詞源", "語源", "語源・語義", "어원", "etymology"
}
CHARACTER_HISTORY_TERMS = re.compile(
    r"甲骨文|金文|小篆|大篆|篆文|古文字|上古音|中古音|拟音|擬音|構擬|構擬音|"
    r"上古汉语|上古漢語|中古汉语|中古漢語"
)


def headings(content):
    pattern = re.compile(r"^(={2,6})\s*(.*?)\s*\1\s*$", re.MULTILINE)
    return [
        (len(match.group(1)), match.group(2).strip(), match.start(), match.end())
        for match in pattern.finditer(content)
    ]


def extract_wiktionary_sections(content, language):
    if language not in LANGUAGE_HEADINGS:
        raise SourceApiError("Unsupported Wiktionary language section", 400)
    matches = headings(content)
    allowed = LANGUAGE_HEADINGS[language]
    language_heading = next(
        (item for item in matches
         if item[0] == 2 and item[1].casefold() in allowed),
        None,
    )
    if not language_heading:
        return {
            "languageSection": None,
            "sectionExcerpt": None,
            "etymology": [],
            "characterHistory": [],
        }

    section_end = next(
        (item[2] for item in matches if item[0] <= 2 and item[2] > language_heading[2]),
        len(content),
    )
    section_content = content[language_heading[3]:section_end]
    section_excerpt = section_content.strip()[:8000]
    subheads = headings(section_content)
    etymology = []
    for index, heading in enumerate(subheads):
        if heading[1].casefold() not in {value.casefold() for value in ETYMOLOGY_HEADINGS}:
            continue
        end = next(
            (item[2] for item in subheads[index + 1:] if item[0] <= heading[0]),
            len(section_content),
        )
        text = section_content[heading[3]:end].strip()
        if text:
            etymology.append({"heading": heading[1], "text": text[:8000]})

    history_lines = []
    for note in etymology:
        for line in note["text"].splitlines():
            if CHARACTER_HISTORY_TERMS.search(line):
                clean_line = line.strip()
                if clean_line and clean_line not in history_lines:
                    history_lines.append(clean_line[:1000])
    return {
        "languageSection": language_heading[1],
        "sectionExcerpt": section_excerpt,
        "etymology": etymology,
        "characterHistory": history_lines,
    }


def matching_korean_words(term, words):
    return [
        word for word in words
        if word.get("language") == "ko"
        and word.get("word", "").strip() == term.strip()
    ]


def explicit_speech_level_candidates(word, entries, words, candidate_data):
    candidates = candidate_data.get("relationships")
    if not isinstance(candidates, list):
        raise SourceApiError("The candidate relationship file is invalid", 500)
    pattern = re.compile(
        r"(?P<other>[가-힣]{1,12})(?:의|에\s*대한)\s*"
        r"(?P<level>높임말|존댓말|반말|예사말|낮춤말)"
    )
    known_korean = {
        item["word"]: item for item in words
        if item.get("language") == "ko" and item.get("id") != word["id"]
    }
    existing_ids = {
        item.get("id")
        for item in candidates
        if isinstance(item, dict)
    }
    existing_pairs = {
        (item.get("sourceWordId"), item.get("targetWordId"), item.get("rawRelationType"))
        for item in candidates
        if isinstance(item, dict)
    }
    production_pairs = {
        (connection.get("sourceWordId"), connection.get("targetWordId"),
         connection.get("rawRelationType"))
        for entry in words
        for connection in entry.get("connections", [])
        if isinstance(connection, dict)
    }
    added = []
    for entry in entries:
        for definition in entry.get("definitions", []):
            for match in pattern.finditer(definition):
                target = known_korean.get(match.group("other"))
                if not target:
                    continue
                identity = (word["id"], target["id"], "speech-level-variant")
                if identity in existing_pairs or identity in production_pairs:
                    continue
                target_code = entry.get("target_code", "entry")
                relationship_id = (
                    f"krdict-speech-level-{word['id']}-{target['id']}-{target_code}"
                )
                relationship_id = re.sub(r"[^A-Za-z0-9._-]+", "-", relationship_id)
                if relationship_id in existing_ids:
                    continue
                source_url = entry.get("link")
                if not source_url:
                    continue
                candidate = {
                    "id": relationship_id,
                    "sourceWordId": word["id"],
                    "targetWordId": target["id"],
                    "productRelationType": None,
                    "rawRelationType": "speech-level-variant",
                    "directionality": "directed",
                    "source": {
                        "label": "KRDict",
                        "url": source_url,
                    },
                    "description": (
                        f"KRDict definition explicitly mentions {target['word']} as "
                        f"{match.group('level')}; candidate only, requires human review."
                    ),
                    "verificationStatus": "candidate",
                    "metadata": {
                        "target_code": entry.get("target_code"),
                        "sup_no": entry.get("sup_no"),
                        "matched_definition": definition,
                        "candidateReason": "explicit-speech-level-wording",
                    },
                }
                candidates.append(candidate)
                existing_ids.add(relationship_id)
                existing_pairs.add(identity)
                added.append(candidate)
    return added


def save_provider_record(path, record):
    with DATA_WRITE_LOCK:
        data = read_json(path, {"entries": []})
        if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
            raise SourceApiError(f"{path.name} must contain an entries array", 500)
        identity = (record["wordId"], record["source"]["label"])
        existing = next(
            (item for item in data["entries"]
             if (item.get("wordId"), item.get("source", {}).get("label")) == identity),
            None,
        )
        if existing is None:
            data["entries"].append(record)
        else:
            existing_fields = existing.get("fields")
            new_fields = record.get("fields")
            if isinstance(existing_fields, dict) and isinstance(new_fields, dict):
                for key, value in new_fields.items():
                    if key == "entries" and isinstance(value, list):
                        saved_entries = existing_fields.setdefault("entries", [])
                        saved_codes = {
                            item.get("target_code") or (
                                item.get("word"),
                                item.get("sup_no", ""),
                                tuple(item.get("definitions", [])),
                            )
                            for item in saved_entries
                        }
                        for item in value:
                            identity = item.get("target_code") or (
                                item.get("word"),
                                item.get("sup_no", ""),
                                tuple(item.get("definitions", [])),
                            )
                            if identity not in saved_codes:
                                saved_entries.append(item)
                                saved_codes.add(identity)
                        continue
                    if value not in (None, "", [], {}) and existing_fields.get(key) in (None, "", [], {}):
                        existing_fields[key] = value
            existing.setdefault("source", record["source"])
            existing.setdefault("fetchedAt", record["fetchedAt"])
            existing.setdefault("word", record["word"])
            existing.setdefault("language", record["language"])
            if record.get("pageTitle"):
                existing.setdefault("pageTitle", record["pageTitle"])
        write_json_atomic(path, data)
        return existing or record


def saved_provider_record(path, word_id, provider_label):
    data = read_json(path, {"entries": []})
    if not isinstance(data, dict) or not isinstance(data.get("entries"), list):
        raise SourceApiError(f"{path.name} must contain an entries array", 500)
    return next(
        (item for item in data["entries"]
         if item.get("wordId") == word_id and item.get("source", {}).get("label") == provider_label),
        None,
    )


def enrich_krdict_word(word_id):
    word = find_word(word_id, "ko")
    saved = saved_provider_record(KRDICT_ENRICHMENT_PATH, word["id"], "KRDict")
    if saved:
        return {
            "provider": "krdict",
            "wordId": word["id"],
            "matchedWordIds": [item["id"] for item in matching_korean_words(word["word"], load_words())],
            "entries": saved.get("fields", {}).get("entries", []),
            "savedRecords": 1,
            "candidateRelationshipsAdded": [],
            "totalMatches": str(len(saved.get("fields", {}).get("entries", []))),
            "cached": True,
        }
    result = request_krdict(word["word"])
    exact_entries = result["exactItems"]
    local_words = load_words()
    matched = matching_korean_words(word["word"], local_words)
    with DATA_WRITE_LOCK:
        candidate_data = read_json(CANDIDATES_PATH, {"relationships": []})
        added_candidates = explicit_speech_level_candidates(
            word,
            exact_entries,
            local_words,
            candidate_data,
        ) if exact_entries else []
        if added_candidates:
            write_json_atomic(CANDIDATES_PATH, candidate_data)

    records = []
    if exact_entries:
        record = {
            "wordId": word["id"],
            "word": word["word"],
            "language": "ko",
            "source": {
                "label": "KRDict",
                "url": "https://krdict.korean.go.kr/",
                "license": "Korean Learners' Dictionary API terms",
            },
            "fetchedAt": utc_now(),
            "fields": {"entries": exact_entries},
        }
        records.append(save_provider_record(KRDICT_ENRICHMENT_PATH, record))
    return {
        "provider": "krdict",
        "wordId": word["id"],
        "matchedWordIds": [item["id"] for item in matched],
        "entries": exact_entries,
        "savedRecords": len(records),
        "candidateRelationshipsAdded": added_candidates,
        "totalMatches": result["total"],
        "cached": False,
    }


def enrich_wiktionary_word(word_id):
    word = find_word(word_id)
    saved = saved_provider_record(
        WIKTIONARY_ENRICHMENT_PATH,
        word["id"],
        "Wiktionary contributors",
    )
    if saved:
        return {
            "provider": "wiktionary",
            "wordId": word["id"],
            "word": word["word"],
            "language": word["language"],
            "pageFound": True,
            "pageTitle": saved.get("pageTitle"),
            "saved": True,
            "cached": True,
            "record": saved,
        }
    title = wiki_title(word)
    result = fetch_wiktionary_page(title)
    if not result["content"]:
        return {
            "provider": "wiktionary",
            "wordId": word["id"],
            "word": word["word"],
            "language": word["language"],
            "pageTitle": result["pageTitle"],
            "pageFound": False,
            "sections": {
                "languageSection": None,
                "sectionExcerpt": None,
                "etymology": [],
                "characterHistory": [],
            },
        }
    sections = extract_wiktionary_sections(result["content"], word["language"])
    if not sections["languageSection"] or not sections["sectionExcerpt"]:
        return {
            "provider": "wiktionary",
            "wordId": word["id"],
            "word": word["word"],
            "language": word["language"],
            "pageFound": True,
            "pageTitle": result["pageTitle"],
            "saved": False,
            "sections": sections,
        }

    page_title = result["pageTitle"]
    record = {
        "wordId": word["id"],
        "word": word["word"],
        "language": word["language"],
        "pageTitle": page_title,
        "source": {
            "label": "Wiktionary contributors",
            "url": f"https://zh.wiktionary.org/wiki/{quote(page_title.replace(' ', '_'), safe='()')}",
            "license": "CC BY-SA 4.0",
            "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        },
        "fetchedAt": utc_now(),
        "fields": sections,
    }
    saved = save_provider_record(WIKTIONARY_ENRICHMENT_PATH, record)
    return {
        "provider": "wiktionary",
        "wordId": word["id"],
        "word": word["word"],
        "language": word["language"],
        "pageFound": True,
        "pageTitle": page_title,
        "saved": True,
        "cached": False,
        "record": saved,
    }
