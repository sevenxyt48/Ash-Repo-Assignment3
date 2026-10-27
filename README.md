# Word Paths

Word Paths is a dependency-free multilingual vocabulary explorer for Chinese, Japanese, Korean, and English. Its single-page interface uses a local word collection to render an interactive relationship graph.

## Project structure

```text
word-paths/
├── index.html
├── css/
│   ├── animations.css
│   └── styles.css
├── data/
│   └── words.json
└── js/
    ├── app.js
    ├── details.js
    ├── graph.js
    └── wordRepository.js
```

The project uses native HTML, CSS, browser JavaScript modules, SVG, and JSON. There is no package manifest, framework, package manager, build step, or server-side API.

## Run and test locally

Serve `word-paths/` over HTTP; the browser loads vocabulary from JSON:

```powershell
cd word-paths
python -m http.server 8000
```

Open <http://localhost:8000>. To check the local data, search for a word such as `water`, `水`, or `soil`, choose a graph node, and confirm its relationships and explanations appear. Search for an unknown word to confirm the app reports that it is not in the local collection.

The repository validates required translations, Pinyin, relationship types, targets, source fields, and verification statuses when it loads the dataset. No automated test or build command is configured.

## Vocabulary and API readiness

`word-paths/js/wordRepository.js` owns vocabulary loading and validation. It currently uses `word-paths/data/words.json`; an optional provider can later be injected through the repository and the local JSON is used if that provider fails or returns invalid data.

Words contain translations by language, Chinese Pinyin, optional language-specific `definitions` and `partsOfSpeech`, and relationships. Each relationship includes a type, explanation, `source` (`null` until evidence is attached), and `verificationStatus`. The current sample relationships are explicitly unverified; they should not be treated as sourced dictionary facts.

The Multilingual Dictionary API is pending approval. No endpoint, authentication scheme, response format, API client, or backend has been assumed or added. Keep credentials server-side if the official access details later require them; `.env` files are ignored by Git. Datamuse, if used later, is limited to English synonym/antonym lookups and is not a source for Chinese, Japanese, or Korean relationships.

See [word-paths/README.md](word-paths/README.md) for the local data contract and integration notes.
