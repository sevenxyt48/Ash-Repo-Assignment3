# Word Paths

Word Paths is a small, static vocabulary explorer for Chinese, English, Japanese, and Korean. Search a word or choose a node to follow its documented relationships in a single interactive map.

## Run locally

The page loads its vocabulary with `fetch`, so serve this directory over HTTP rather than opening `index.html` directly. For example, with Python installed:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Explore

- Search words, translations, and pronunciations; unknown terms are reported without invented definitions.
- Choose the word-display language, roll for a random word, or select a connected node to make it the center.
- Toggle the four relationship types independently. The optional **Other languages** control adds translations to graph nodes.
- Drag the map to pan; scroll or use the controls to zoom. Keyboard users can tab to nodes and activate them with Enter or Space.
- Chinese nodes always include Hanyu Pinyin when another display language is selected. Chinese translations in word details include Pinyin as well.
- The graph honors `prefers-reduced-motion`.

## Curated vocabulary

`data/words.json` is a deliberately small prototype dataset. Each entry contains a stable ID, translations, pronunciation support, a short English meaning, and documented connections. A connection has one of four types:

- `origin`: character formation or word history, with the explanation stating the scope of the claim.
- `similar`: closely related meanings; an explanation distinguishes semantic neighbors from exact synonyms.
- `confusable`: forms that are easy to mistake for one another.
- `antonym`: words with opposing meanings.

Relationships are written as directed entries and displayed in both directions. Add a connection only when its explanation can be supported; do not infer a shared origin from translated words alone.

## Structure

```text
word-paths/
├── index.html
├── css/
│   ├── styles.css
│   └── animations.css
├── data/
│   └── words.json
└── js/
    ├── app.js
    ├── graph.js
    └── details.js
```

The app uses native HTML, CSS, JavaScript, and SVG. It has no build step or third-party JavaScript dependencies.
