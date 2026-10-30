# Word Paths

Word Paths is an interactive web experience for exploring relationships between Chinese, Japanese, and Korean words that use Chinese characters. Instead of treating each word as an isolated dictionary entry, it presents related words as a visual network that users can explore by searching, filtering relationships, and selecting nodes.

**Course:** SD5913 — Interactive Experience  
**Project type:** Individual project  
**Status:** MVP in development

## The Idea

Word Paths is designed mainly for native Chinese speakers who are learning Japanese or Korean, as well as people interested in comparing vocabulary across these languages. Similar-looking words can have different meanings, readings, or usage. A relationship graph makes these connections easier to notice and investigate.

The experience focuses on the relationship between words rather than on providing a complete dictionary. The available vocabulary and relationships are limited by the data sources that can be accessed and verified during the project.

## Main Interaction

The intended interaction loop is **search or discover → inspect relationships → select a related word → explore again**.

- **Start exploring:** The page loads an available starting word and its connected words.
- **Search:** Enter a word to find matching entries in the available dataset. Chinese and Japanese searches for the same written form should show language labels so users can distinguish the entries.
- **Explore randomly:** Use the dice button to discover another available word.
- **Filter relationships:** Show or hide relationship categories to focus on the connections that matter.
- **Follow a connection:** Select a related word to make it the new focus of the graph.
- **Check a translation:** Hover over a word to see an English helper translation when one is available.
- **Change the interface language:** The interface supports Chinese, English, Japanese, and Korean. This changes the interface text, not the dictionary scope: the core vocabulary remains Chinese, Japanese, and Korean.
- **Understand the data scope:** The page reports the actual number of available entries and relationships, with a note that coverage is limited.

The graph separates cross-language equivalents from semantic relationships. Semantic relationships are etymology, similar meaning, easily confused, and antonyms. Corresponding words across Chinese, Japanese, and Korean are not automatically synonyms. Only reviewed relationships are shown in production.

## Preview

Add screenshots from the running project before submission. Keep the image files in the repository and update these paths to match their actual locations.

![Main interface](assets/images/main-interface.png)

*Main interface: search, language selection, relationship filters, and the word graph.*

![Word relationship graph](assets/images/relationship-graph.png)

*Example interaction: selecting a related word updates the graph.*

> If these screenshots have not been added yet, replace this section with real screenshots before submitting the repository.

## Run Locally

The project is a static web app built with HTML, CSS, and JavaScript. It uses local JSON data, so run it through a local HTTP server rather than opening `index.html` directly.

1. Clone or download this repository.
2. Open a terminal in the project directory (the directory containing `index.html`).
3. Start Python's built-in static server:

```bash
python -m http.server 8000
```

4. Open [http://localhost:8000](http://localhost:8000) in your browser.

You can also use the VS Code Live Server extension to serve the project directory. If port 8000 is already in use, choose another port, such as `python -m http.server 8001`, and open the matching local URL.

No package installation or build step is required for the static version. If the project structure changes, update these instructions to match the final repository.

## Project Structure

The current planned structure is:

```text
word-paths/
├── index.html
├── css/
│   ├── styles.css
│   └── animations.css
├── js/
│   ├── app.js
│   ├── graph.js
│   ├── details.js
│   ├── relationshipValidation.mjs
│   └── auditCandidates.mjs
├── data/
│   ├── words.json
│   ├── demo-relationships.json
│   └── candidate-relationships.json
├── assets/
│   └── images/
├── README.md
└── PROCESS.md
```

The actual repository may differ as development continues. Keep this tree synchronized with the files committed to GitHub.

## Data and Technical Notes

- The interface is built with native HTML, CSS, and JavaScript.
- SVG can be used to draw the word nodes and connecting lines.
- The local JSON dataset stores available word entries and their relationships.
- The multilingual dictionary API application is still pending approval, so the MVP must not depend on that API being available.
- ConceptNet or another external source may be unavailable or return errors. The app should continue to provide the local data experience where possible.
- English is used only as a helper translation; it is not a fourth core dictionary language.
- The dataset is intentionally small. Word Paths does not claim to cover all Chinese, Japanese, or Korean vocabulary.
- Production relationships use `verified` status. `candidate` records belong in `data/candidate-relationships.json`; `demo` fixtures belong in `data/demo-relationships.json`; rejected records are retained with `rejected` status and are never displayed.
- Relationship types are `equivalent` (cross-language correspondence) and the four semantic types `origin`, `similar`, `confusable`, and `antonym`. `directionality` is `directed` for `origin` and `symmetric` for the other four types.

## Candidate relationship review

Add source-backed, unverified records to `word-paths/data/candidate-relationships.json` with a unique `id`, existing `sourceWordId` and `targetWordId`, `rawRelationType`, `productRelationType` (use `null` until a human assigns a product category), `directionality`, `verificationStatus: "candidate"`, a `source` label and URL, and a concise `description`. Do not infer a product relationship from a ConceptNet label or API success.

From the repository root, run the dependency-free checker with Node.js:

```bash
node word-paths/js/auditCandidates.mjs
```

The checker verifies endpoint IDs/languages, self-loops, duplicate IDs and relationships, allowed types/statuses, directionality, cross-language constraints, and source/description fields. A clean check is a structural check only: a person must still confirm the meaning, etymology, confusion risk, antonymy, or cross-language correspondence against the cited evidence.

After review, manually move an accepted record into the `connections` array of its source word in `word-paths/data/words.json`, assign its confirmed `productRelationType`, set `verificationStatus` to `verified`, and retain its evidence and raw source type. Move rejected records out of the candidate queue and preserve them with `verificationStatus: "rejected"` in the local relationship records if an audit trail is needed. Never copy candidate or demo data into production as verified without review. Run the checker again after editing the queue.

## Error Handling and Known Limitations

- **No search results:** Show a clear empty state and let the user edit the query or try another word.
- **No verified relationships:** Show the word without fabricating connections, and explain that no usable related data is available.
- **External API unavailable:** Do not let an unavailable service prevent the local dataset from loading.
- **Missing English helper translation:** Omit the translation rather than displaying guessed text.
- **Limited coverage:** The graph only reflects the entries and relationships currently available in the dataset. Some words may have few or no connections.
- **Relationship accuracy:** Similar written forms do not automatically mean words share the same meaning or origin. Relationship types should be shown only when supported by the available data.

## Credits

Word Paths is an individual student project for SD5913. Credit any external APIs, datasets, code examples, libraries, fonts, icons, or media used in the final implementation here, including their source links and licences where applicable. Do not include material unless its source and permitted use have been checked.

## Development Process

See [`PROCESS.md`](PROCESS.md) for the starting idea, implementation decisions, user trial, iteration, and disclosure of AI tools used. This file should be completed with the actual testing observations and decisions before submission.

## Project Links

- **GitHub repository:** Add the public repository URL before submission.
- **Live demo:** Add a deployed URL if available.
- **Course:** SD5913 — Interactive Experience
