<!-- 此文件说明前端词汇数据模型、公共 API 接入和数据来源要求。 -->

# Word Paths

The frontend explores Chinese, Japanese, Korean, and English words using local vocabulary and public APIs in an interactive SVG graph. It uses native browser technologies and has no build step or package dependencies.

## Run locally

From this directory, start the local static server and ConceptNet proxy:

```powershell
python server.py
```

Then open <http://127.0.0.1:8000>. Python 3 is required. The server proxies only the fixed ConceptNet lookup route because ConceptNet does not currently return browser CORS headers; configure an equivalent same-origin endpoint when deploying to static hosting. MyMemory is called directly by the browser.

## Local data

`data/words.json` remains the local starter vocabulary. `js/wordRepository.js` loads and validates it. `js/vocabularyApi.js` provides public ConceptNet and MyMemory adapters; searching for a word not in the local collection queries ConceptNet. Successful API responses are cached in memory for the current page session.

Each word contains:

- `translations`: values keyed by `zh`, `ja`, `ko`, and `en` for local words; an API node only claims its returned source-language label;
- local words include `pinyin` and `romanization`; API nodes do not invent pronunciation data;
- `meaning`: the English fallback definition;
- optional `definitions` and `partsOfSpeech` maps, keyed by language, for sourced data when available;
- `connections`: an array of typed relationships.

Every relationship needs a `target`, `type`, `explanation`, `source`, and `verificationStatus`. `source` is `null` until a source is attached, or an object such as `{ "label": "Dictionary name", "url": "https://…" }`. `verificationStatus` is `unverified` or `verified`; verified relationships must include a source. The current sample links are marked unverified and are not represented as sourced facts.

The loader checks local four-language translations and readings, plus relationship targets/types, explanations, source fields, and verification state. API words carry a `language` and ConceptNet source, and may have sparse translations. Their relation `type` is the original ConceptNet label (for example `RelatedTo`), not a UI synonym category. Edge weight, dataset, license, source URL, and relation are retained; duplicate same-direction edges are removed. A missing edge list leaves an isolated word and an explicit empty-result state.

## Public APIs and attribution

- ConceptNet lookup: `https://api.conceptnet.io/c/{language}/{term}?limit=100`, for `zh`, `ja`, `en`, and `ko`. Chinese characters are queried as Chinese by default; select Japanese in the display-language menu to query kanji-only Japanese terms. Hiragana, katakana, and Hangul are detected automatically. No API key is used.
- MyMemory lookup: `https://api.mymemory.translated.net/get`, with URL-encoded `q` and `langpair` parameters. Hover an API graph node to request its English translation. The service adapter supports translation to/from English for Chinese (`zh-CN`), Japanese (`ja`), English, and Korean.
- ConceptNet is attributed by name. Its API returns a license for each edge; the app preserves and displays that exact edge license/source rather than relabeling all edges. ConceptNet's API documentation states that some edges are CC BY 4.0, some CC BY-SA 4.0, and reuse of ConceptNet as a whole requires following CC BY-SA 4.0. ShareAlike, attribution, and indication of changes therefore apply when redistributing a combined/modified ConceptNet dataset. See the [ConceptNet API documentation](https://github.com/commonsense/conceptnet5/wiki/API), [CC BY-SA 4.0 deed](https://creativecommons.org/licenses/by-sa/4.0/), and [license text](https://creativecommons.org/licenses/by-sa/4.0/legalcode).
- MyMemory's [API specifications](https://mymemory.translated.net/doc/spec.php), [usage limits](https://mymemory.translated.net/doc/usagelimits.php), and [terms](https://mymemory.translated.net/terms-and-conditions) apply. Anonymous use is limited to 5,000 characters/day; its terms prohibit translating more than one paragraph per request and disallow abnormal traffic. The app sends only the hovered word; translations may be inaccurate and requests disclose that word to MyMemory.

ConceptNet requests pass through the same-origin Python server; MyMemory is called directly by the browser. Availability, rate limits, and network access can prevent requests; calls time out after 15 seconds and the local vocabulary remains available. No key-gated services are included.
