import { renderGraph, resetGraphView, zoomGraph } from "./graph.js";
import { renderDetails, renderEmptyDetails } from "./details.js";

const graphContainer = document.querySelector("#graph");
const graphMessage = document.querySelector("#graph-message");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search");
const searchMessage = document.querySelector("#search-message");
const suggestions = document.querySelector("#word-suggestions");
const languageSelect = document.querySelector("#language");
const randomButton = document.querySelector("#random");
const detailsPanel = document.querySelector("#details");
const resultCount = document.querySelector("#result-count");
const filters = [...document.querySelectorAll("[data-filter]")];
const otherLanguagesButton = document.querySelector("#other-languages");

const state = {
  data: null,
  language: "en",
  selectedId: null,
  selectedRelation: null,
  activeTypes: new Set(["origin", "similar", "confusable", "antonym"]),
  otherLanguages: false,
  query: ""
};

function normalized(value) {
  return value.trim().toLocaleLowerCase();
}

function wordSearchTerms(word) {
  return [
    word.id,
    word.meaning,
    word.pinyin,
    ...Object.values(word.translations),
    ...Object.values(word.romanization)
  ].filter(Boolean).map(normalized);
}

function getConnections(word) {
  const connections = new Map();
  for (const item of state.data.words) {
    for (const connection of item.connections) {
      if (!state.activeTypes.has(connection.type)) continue;
      if (item.id === word.id) {
        const target = state.data.words.find((candidate) => candidate.id === connection.target);
        if (target) connections.set(target.id, { ...connection, word: target });
      } else if (connection.target === word.id) {
        connections.set(item.id, {
          ...connection,
          target: item.id,
          word: item
        });
      }
    }
  }
  return [...connections.values()];
}

function selectWord(id, relation = null) {
  state.selectedId = id;
  state.selectedRelation = relation;
  state.query = "";
  searchInput.value = "";
  searchMessage.textContent = "";
  searchMessage.classList.remove("is-error");
  render();
}

function render() {
  const selected = state.data.words.find((word) => word.id === state.selectedId);
  if (!selected) return;

  const graphResult = renderGraph(graphContainer, state.data.words, {
    language: state.language,
    selectedId: state.selectedId,
    query: state.query,
    activeTypes: state.activeTypes,
    otherLanguages: state.otherLanguages,
    relationshipTypes: state.data.relationshipTypes,
    onSelect: selectWord
  });

  const connectionCount = graphResult.edgeCount;
  resultCount.textContent = connectionCount
    ? `${graphResult.nodeCount} words · ${connectionCount} ${connectionCount === 1 ? "connection" : "connections"}`
    : "No connections match these filters";

  const relation = state.selectedRelation
    ? {
        ...state.selectedRelation,
        word: undefined
      }
    : null;
  renderDetails(
    detailsPanel,
    selected,
    state.data,
    state.language,
    relation,
    getConnections(selected),
    selectWord
  );
}

function showMessage(message, isError = false) {
  searchMessage.textContent = message;
  searchMessage.classList.toggle("is-error", isError);
}

function findMatches(query) {
  const term = normalized(query);
  if (!term) return [];
  return state.data.words.filter((word) =>
    wordSearchTerms(word).some((candidate) => candidate === term || candidate.startsWith(term))
  );
}

function exploreSearch(query) {
  const term = normalized(query);
  if (!term) return;
  const exact = state.data.words.find((word) =>
    wordSearchTerms(word).some((candidate) => candidate === term)
  );
  if (exact) {
    selectWord(exact.id);
    return;
  }
  const matches = findMatches(query);
  if (matches.length === 1) {
    selectWord(matches[0].id);
    return;
  }
  if (matches.length > 1) {
    showMessage("A few words match. Add another character or choose a suggestion.", true);
    return;
  }
  showMessage(`“${query.trim()}” isn’t in this small collection yet. Try water, 水, hope, 白天, or 土.`, true);
}

function fillSuggestions() {
  const values = new Set();
  for (const word of state.data.words) {
    for (const value of wordSearchTerms(word)) values.add(value);
  }
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    suggestions.append(option);
  }
}

async function initialize() {
  try {
    const response = await fetch("./data/words.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!Array.isArray(state.data.words) || state.data.words.length === 0) {
      throw new Error("Word data is empty or invalid");
    }
    const ids = new Set(state.data.words.map((word) => word.id));
    for (const word of state.data.words) {
      if (!word.connections.every((connection) => ids.has(connection.target))) {
        throw new Error(`Word "${word.id}" references a missing connection`);
      }
    }
    fillSuggestions();
    state.selectedId = state.data.words[Math.floor(Math.random() * state.data.words.length)].id;
    graphMessage.hidden = true;
    render();
  } catch (error) {
    console.error("Unable to load the word graph:", error);
    graphMessage.hidden = false;
    graphMessage.textContent = "The word collection could not be loaded. Open this page through a local web server, then refresh.";
    resultCount.textContent = "Word collection unavailable";
    renderEmptyDetails(detailsPanel);
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  exploreSearch(searchInput.value);
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  if (!query) {
    showMessage("");
    return;
  }
  const matches = findMatches(query);
  showMessage(matches.length ? `${matches.length} word${matches.length === 1 ? "" : "s"} to explore — press Enter` : "Press Enter to check this word.");
});

languageSelect.addEventListener("change", () => {
  state.language = languageSelect.value;
  if (state.data) render();
});

for (const button of filters) {
  button.addEventListener("click", () => {
    const type = button.dataset.filter;
    if (state.activeTypes.has(type)) state.activeTypes.delete(type);
    else state.activeTypes.add(type);
    button.setAttribute("aria-pressed", String(state.activeTypes.has(type)));
    if (state.data) render();
  });
}

otherLanguagesButton.addEventListener("click", () => {
  state.otherLanguages = !state.otherLanguages;
  otherLanguagesButton.setAttribute("aria-pressed", String(state.otherLanguages));
  if (state.data) render();
});

randomButton.addEventListener("click", () => {
  if (!state.data) return;
  const choices = state.data.words.filter((word) => word.id !== state.selectedId);
  const pool = choices.length ? choices : state.data.words;
  selectWord(pool[Math.floor(Math.random() * pool.length)].id);
});

document.querySelector("#zoom-in").addEventListener("click", () => zoomGraph(1));
document.querySelector("#zoom-out").addEventListener("click", () => zoomGraph(-1));
document.querySelector("#zoom-reset").addEventListener("click", resetGraphView);

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    state.query = "";
    showMessage("");
    searchInput.blur();
  }
});

initialize();
