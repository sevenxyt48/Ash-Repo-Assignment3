<!-- 此文件介绍 Word Paths 项目结构、本地运行方式和词汇数据准备情况。 -->

# Word Paths

Word Paths is a multilingual vocabulary explorer for Chinese, Japanese, Korean, and English. Its single-page interface uses a local word collection and public word APIs to render an interactive relationship graph.

## Project structure

```text
word-paths/
├── index.html
├── server.py
├── css/
│   ├── animations.css
│   └── styles.css
├── data/
│   └── words.json
└── js/
    ├── app.js
    ├── details.js
    ├── graph.js
    ├── vocabularyApi.js
    └── wordRepository.js
```

The project uses native HTML, CSS, browser JavaScript modules, SVG, and JSON, with a small Python standard-library server to proxy ConceptNet requests blocked by browser CORS. There is no package manifest, framework, package manager, or build step.

## Run and test locally

From `word-paths/`, run the static server and ConceptNet proxy (Python 3):

```powershell
python server.py
```

Open <http://127.0.0.1:8000>. To check the local data, search for `water`, `水`, or `soil`. Search a word not in the local collection to query ConceptNet; this requires the proxy server.

The repository validates local translations/readings and the normalized relationship target, type, source, and verification fields. API nodes can use sparse language labels while preserving their source metadata. No automated test or build command is configured.

## Vocabulary and public APIs

`word-paths/js/wordRepository.js` owns local vocabulary loading and validation. `word-paths/js/vocabularyApi.js` integrates keyless ConceptNet relationship lookups and MyMemory hover translation. Searching a local miss fetches the requested word and its sourced relations; local sample data and UI remain available if a request fails. See [word-paths/README.md](word-paths/README.md) for behavior, licensing, data model, and API limitations.
