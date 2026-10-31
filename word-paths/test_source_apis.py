import os
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from source_apis import (
    enrich_krdict_word,
    SourceApiError,
    WIKTIONARY_USER_AGENT,
    enrich_wiktionary_word,
    explicit_speech_level_candidates,
    extract_wiktionary_sections,
    fetch_wiktionary_page,
    matching_korean_words,
    parse_krdict_xml,
    read_json,
    request_krdict,
    save_provider_record,
)


KRDICT_XML = """<?xml version="1.0" encoding="UTF-8"?>
<channel>
  <total>2</total>
  <item>
    <target_code>100001</target_code><word>학교</word><sup_no>1</sup_no>
    <origin>學校</origin><pronunciation>학꾜</pronunciation>
    <word_grade>초급</word_grade><pos>명사</pos><link>https://krdict.korean.go.kr/item/1</link>
    <sense><definition>일정한 목적, 교과 과정, 설비, 제도 및 법규에 의하여 계속적으로 학생에게 교육하는 기관.</definition></sense>
  </item>
  <item>
    <target_code>100002</target_code><word>학교</word><sup_no>2</sup_no>
    <pos>명사</pos><link>https://krdict.korean.go.kr/item/2</link>
    <sense><definition>배우는 곳.</definition></sense>
  </item>
</channel>"""


class SourceApiTests(unittest.TestCase):
    def test_krdict_xml_handles_multiple_items_and_definitions(self):
        parsed = parse_krdict_xml(KRDICT_XML.encode("utf-8"))
        self.assertEqual(parsed["total"], "2")
        self.assertEqual(len(parsed["items"]), 2)
        self.assertEqual(parsed["items"][0]["target_code"], "100001")
        self.assertEqual(parsed["items"][0]["origin"], "學校")
        self.assertIn("교육하는 기관", parsed["items"][0]["definitions"][0])

    def test_krdict_request_sends_key_server_side_and_matches_exact_word(self):
        with patch.dict(os.environ, {"KRDICT_API_KEY": "test-key"}, clear=False), \
             patch("source_apis.fetch_url", return_value=(200, KRDICT_XML.encode("utf-8"))) as fetch:
            result = request_krdict("학교")
        self.assertEqual(len(result["exactItems"]), 2)
        request_url = fetch.call_args.args[0]
        self.assertIn("key=test-key", request_url)

    def test_missing_krdict_key_is_reported_without_request(self):
        with patch.dict(os.environ, {"KRDICT_API_KEY": ""}, clear=False), \
             patch("source_apis.fetch_url") as fetch:
            with self.assertRaises(SourceApiError) as raised:
                request_krdict("학교")
        self.assertEqual(raised.exception.status, 503)
        fetch.assert_not_called()

    def test_wiktionary_extracts_only_the_requested_language(self):
        content = """== 汉语 ==
=== 字源 ===
金文中可见早期字形。上古音：*example
== 日语 ==
=== 词源 ===
日语词源资料。
== 朝鮮語 ==
=== 어원 ===
한국어 어원 자료.
"""
        japanese = extract_wiktionary_sections(content, "ja")
        korean = extract_wiktionary_sections(content, "ko")
        chinese = extract_wiktionary_sections(content, "zh")
        self.assertEqual(japanese["languageSection"], "日语")
        self.assertIn("日语词源资料", japanese["etymology"][0]["text"])
        self.assertIn("日语", japanese["sectionExcerpt"])
        self.assertNotIn("汉语", japanese["etymology"][0]["text"])
        self.assertEqual(korean["languageSection"], "朝鮮語")
        self.assertIn("한국어 어원 자료", korean["sectionExcerpt"])
        self.assertEqual(chinese["characterHistory"], [
            "金文中可见早期字形。上古音：*example"
        ])

    def test_missing_wiktionary_language_section_returns_empty_data(self):
        extracted = extract_wiktionary_sections("== 汉语 ==\n=== 字源 ===\n字形资料。", "ja")
        self.assertIsNone(extracted["languageSection"])
        self.assertIsNone(extracted["sectionExcerpt"])
        self.assertEqual(extracted["etymology"], [])

    def test_wiktionary_request_sends_project_user_agent(self):
        body = json.dumps({
            "query": {"pages": [{
                "title": "水",
                "revisions": [{"slots": {"main": {"content": "== 汉语 =="}}}],
            }]}
        }).encode("utf-8")
        with patch("source_apis.fetch_url", return_value=(200, body)) as fetch:
            page = fetch_wiktionary_page("水")
        headers = fetch.call_args.args[1]
        self.assertEqual(headers["User-Agent"], WIKTIONARY_USER_AGENT)
        self.assertIn("WordPaths/1.0", headers["User-Agent"])
        self.assertIn("github.com/sevenxyt48/Ash-Repo-Assignment3", headers["User-Agent"])
        self.assertIn("contact:", headers["User-Agent"])
        self.assertEqual(page["pageTitle"], "水")

    def test_explicit_speech_level_match_creates_candidate_only(self):
        source = {"id": "test-ko-honorific", "word": "선생님", "language": "ko"}
        target = {"id": "test-ko-plain", "word": "선생", "language": "ko"}
        candidates = {"relationships": []}
        added = explicit_speech_level_candidates(
            source,
            [{"target_code": "10", "link": "https://krdict.korean.go.kr/item/10",
              "definitions": ["선생의 높임말."]}],
            [source, target],
            candidates,
        )
        self.assertEqual(len(added), 1)
        self.assertIsNone(added[0]["productRelationType"])
        self.assertEqual(added[0]["verificationStatus"], "candidate")
        self.assertEqual(candidates["relationships"], added)
        self.assertEqual(explicit_speech_level_candidates(
            source,
            [{"target_code": "10", "link": "https://krdict.korean.go.kr/item/10",
              "definitions": ["선생의 높임말."]}],
            [source, target],
            candidates,
        ), [])

    def test_existing_provider_record_is_reused_without_another_request(self):
        record = {
            "wordId": "water-zh",
            "word": "水",
            "language": "zh",
            "pageTitle": "水",
            "source": {"label": "Wiktionary contributors", "url": "https://zh.wiktionary.org/wiki/%E6%B0%B4"},
            "fetchedAt": "2026-10-31T00:00:00+00:00",
            "fields": {
                "languageSection": "漢語",
                "sectionExcerpt": "source text",
                "etymology": [],
                "characterHistory": [],
            },
        }
        with patch("source_apis.saved_provider_record", return_value=record), \
             patch("source_apis.fetch_wiktionary_page") as fetch:
            response = enrich_wiktionary_word("water-zh")
        self.assertTrue(response["cached"])
        self.assertEqual(response["record"], record)
        fetch.assert_not_called()

    def test_krdict_cached_records_include_all_distinct_senses(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = os.path.join(temporary, "krdict.json")
            base = {
                "wordId": "water-ko",
                "word": "물",
                "language": "ko",
                "source": {"label": "KRDict", "url": "https://krdict.korean.go.kr/"},
                "fetchedAt": "2026-10-31T00:00:00+00:00",
                "fields": {"entries": [
                    {"target_code": "1", "word": "물", "definitions": ["sense 1"]}
                ]},
            }
            save_provider_record(Path(path), base)
            additional = {
                **base,
                "fields": {"entries": [
                    {"target_code": "2", "word": "물", "definitions": ["sense 2"]}
                ]},
            }
            merged = save_provider_record(Path(path), additional)
        self.assertEqual(
            [entry["target_code"] for entry in merged["fields"]["entries"]],
            ["1", "2"],
        )

    def test_krdict_speech_level_candidate_is_saved_only_to_candidate_queue(self):
        source = {"id": "test-ko-honorific", "word": "선생님", "language": "ko"}
        target = {"id": "test-ko-plain", "word": "선생", "language": "ko"}
        entry = {
            "word": "선생님",
            "target_code": "1001",
            "sup_no": "1",
            "link": "https://krdict.korean.go.kr/item/1001",
            "definitions": ["선생의 높임말."],
        }
        with tempfile.TemporaryDirectory() as temporary:
            candidate_path = Path(temporary) / "candidate.json"
            krdict_path = Path(temporary) / "krdict.json"
            candidate_path.write_text('{"relationships":[]}', encoding="utf-8")
            with patch("source_apis.find_word", return_value=source), \
                 patch("source_apis.load_words", return_value=[source, target]), \
                 patch("source_apis.saved_provider_record", return_value=None), \
                 patch("source_apis.request_krdict", return_value={
                     "exactItems": [entry], "total": "1"
                 }), \
                 patch("source_apis.CANDIDATES_PATH", candidate_path), \
                 patch("source_apis.KRDICT_ENRICHMENT_PATH", krdict_path):
                result = enrich_krdict_word(source["id"])
            saved_candidates = read_json(candidate_path, {})
            saved_enrichment = read_json(krdict_path, {})
        self.assertEqual(len(result["candidateRelationshipsAdded"]), 1)
        candidate = saved_candidates["relationships"][0]
        self.assertEqual(candidate["verificationStatus"], "candidate")
        self.assertIsNone(candidate["productRelationType"])
        self.assertEqual(saved_enrichment["entries"][0]["wordId"], source["id"])

    def test_word_ids_and_languages_are_not_inferred_by_shared_spelling(self):
        words = [
            {"id": "water-zh", "word": "水", "language": "zh"},
            {"id": "water-ja", "word": "水", "language": "ja"},
            {"id": "water-ko", "word": "물", "language": "ko"},
        ]
        self.assertEqual(matching_korean_words("水", words), [])
        self.assertEqual(
            [word["id"] for word in matching_korean_words("물", words)],
            ["water-ko"],
        )


if __name__ == "__main__":
    unittest.main()
