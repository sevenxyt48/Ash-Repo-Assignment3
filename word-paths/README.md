# Word Paths

The static frontend explores Chinese, Japanese, Korean, and English words using a local vocabulary and interactive SVG graph. It uses native browser technologies and has no build step or package dependencies.

## Run locally

From this directory, serve the files over HTTP:

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000>. The page must be served over HTTP to load the JSON file.

## Local data

`data/words.json` is the current vocabulary source. `js/wordRepository.js` loads and validates it separately from the page and graph rendering code. The loader accepts an optional asynchronous `apiLoader` provider returning this same normalized dataset; if the provider throws or returns invalid data, the repository logs the issue and uses the local dataset.

Each word contains:

- `translations`: values keyed by `zh`, `ja`, `ko`, and `en`;
- `pinyin` and `romanization` for pronunciation support;
- `meaning`: the English fallback definition;
- optional `definitions` and `partsOfSpeech` maps, keyed by language, for sourced data when available;
- `connections`: an array of typed relationships.

Every relationship needs a `target`, `type`, `explanation`, `source`, and `verificationStatus`. `source` is `null` until a source is attached, or an object such as `{ "label": "Dictionary name", "url": "https://…" }`. `verificationStatus` is `unverified` or `verified`; verified relationships must include a source. The current sample links are marked unverified and are not represented as sourced facts.

The loader checks the four translations, Pinyin, valid relationship targets/types, explanations, source fields, and verification state. The detail panel shows relationship verification and source information. Chinese Pinyin remains visible for Chinese words in non-Chinese display languages.

## API preparation

The Multilingual Dictionary API is pending approval. This project has no backend, API endpoints, credentials, or API response assumptions. Once access and official documentation are available, implement a provider adapter that normalizes its verified response into the local dataset contract. Keep secrets server-side if required; `.env` files are ignored by Git.

Datamuse may be used for English synonym/antonym lookups only. Do not use its English relationship results for Chinese, Japanese, or Korean.
