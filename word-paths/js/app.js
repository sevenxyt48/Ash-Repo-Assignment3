// 此文件协调页面状态、搜索、筛选、词汇仓库和关系图渲染。
import { renderGraph, resetGraphView, zoomGraph } from "./graph.js";
import { renderDetails, renderEmptyDetails } from "./details.js";
import { loadWordDataset, validateWordDataset } from "./wordRepository.js";
import { fetchConceptNetWord, translateText } from "./vocabularyApi.js";

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
  localData: null,
  language: "en",
  selectedId: null,
  selectedRelation: null,
  activeTypes: new Set(["origin", "similar", "confusable", "antonym"]),
  otherLanguages: false,
  query: "",
  apiEmpty: false,
  apiError: false,
  searchRequest: 0
};

function normalized(value) {
  return value.trim().toLocaleLowerCase();
}

function wordSearchTerms(word) {
  return [
    word.id,
    word.word,
    word.englishTranslation,
    word.meaning,
    ...Object.values(word.definitions ?? {}),
    word.pinyin,
    ...Object.values(word.translations),
    ...Object.values(word.romanization)
  ].filter(Boolean).map(normalized);
}

function getConnections(word) {
  const connections = new Map();
  for (const item of state.data.words) {
    for (const connection of item.connections) {
      if (connection.verificationStatus !== "verified" ||
          !connection.productRelationType ||
          !state.activeTypes.has(connection.productRelationType)) continue;
      const targetId = item.id === word.id ? connection.targetWordId : item.id;
      if (item.id !== word.id && connection.targetWordId !== word.id) continue;
      const key = `${targetId}\u0000${connection.productRelationType}`;
      if (connections.has(key)) continue;
      if (item.id === word.id) {
        const target = state.data.words.find((candidate) => candidate.id === connection.targetWordId);
        if (target) connections.set(key, { ...connection, word: target });
      } else {
        connections.set(key, {
          ...connection,
          targetWordId: item.id,
          word: item
        });
      }
    }
  }
  return [...connections.values()];
}

function hasVerifiedConnections(word, words) {
  if (!word) return false;
  return words.some((item) =>
    item.connections.some((connection) =>
      connection.verificationStatus === "verified" &&
      connection.productRelationType &&
      (item.id === word.id || connection.targetWordId === word.id)
    )
  );
}

function selectWord(id, relation = null) {
  state.selectedId = id;
  state.selectedRelation = relation;
  if (state.data === state.localData) {
    state.apiEmpty = !hasVerifiedConnections(
      state.data.words.find((word) => word.id === id),
      state.data.words
    );
    state.apiError = false;
  }
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
    onSelect: selectWord,
    onHover: (word) => word.englishTranslation
      ? Promise.resolve(word.englishTranslation)
      : translateText(word.word, word.language, "en")
  });
  graphMessage.hidden = !state.apiEmpty && !state.apiError;
  if (state.apiEmpty) {
    graphMessage.textContent = "No verified relationships are available for this word.";
  } else if (state.apiError) {
    graphMessage.textContent = "The vocabulary service is unavailable. Check your connection and try again.";
  }

  const connectionCount = graphResult.edgeCount;
  resultCount.textContent = state.apiEmpty
    ? "No verified relationships found"
    : connectionCount
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
  return findMatchesIn(query, state.localData);
}

function findMatchesIn(query, data) {
  const term = normalized(query);
  if (!term) return [];
  return data.words.filter((word) =>
    wordSearchTerms(word).some((candidate) => candidate === term || candidate.startsWith(term))
  );
}

function queryLanguage(query) {
  if (/\p{Script=Hangul}/u.test(query)) return "ko";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(query)) return "ja";
  if (/\p{Script=Han}/u.test(query)) {
    return languageSelect.value === "ja" ? "ja" : "zh";
  }
  return "en";
}

async function exploreSearch(query) {
  const requestId = ++state.searchRequest;
  const term = normalized(query);
  if (!term) return;
  state.data = state.localData;
  state.apiEmpty = false;
  state.apiError = false;
  const exact = state.localData.words.find((word) =>
    wordSearchTerms(word).some((candidate) => candidate === term)
  );
  if (exact) {
    selectWord(exact.id);
    return;
  }
  const matches = findMatchesIn(query, state.localData);
  if (matches.length === 1) {
    selectWord(matches[0].id);
    return;
  }
  if (matches.length > 1) {
    showMessage("A few words match. Add another character or choose a suggestion.", true);
    return;
  }
  const language = queryLanguage(query);
  if (language === "en") {
    showMessage("No matching word was found in the Chinese, Japanese, and Korean vocabulary.", true);
    return;
  }
  showMessage(`Looking up “${query.trim()}” in ConceptNet…`);
  try {
    const data = await fetchConceptNetWord(query, language);
    if (requestId !== state.searchRequest) return;
    state.data = data;
    validateWordDataset(state.data);
    for (const type of Object.keys(state.data.relationshipTypes)) state.activeTypes.add(type);
    state.selectedId = state.data.words[0].id;
    state.selectedRelation = null;
    state.apiEmpty = !hasVerifiedConnections(state.data.words[0], state.data.words);
    state.apiError = false;
    graphMessage.hidden = true;
    searchMessage.classList.remove("is-error");
    searchMessage.textContent = "";
    render();
  } catch (error) {
    if (requestId !== state.searchRequest) return;
    console.error("ConceptNet lookup failed:", error);
    state.data = state.localData;
    state.apiEmpty = false;
    state.apiError = true;
    if (!state.localData.words.some((word) => word.id === state.selectedId)) {
      state.selectedId = state.localData.words[0].id;
      state.selectedRelation = null;
    }
    render();
    resultCount.textContent = "ConceptNet unavailable";
    showMessage("Could not retrieve this word from ConceptNet.", true);
  }
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
    state.data = await loadWordDataset();
    state.localData = state.data;
    fillSuggestions();
    state.selectedId = state.data.words[Math.floor(Math.random() * state.data.words.length)].id;
    state.apiEmpty = !hasVerifiedConnections(
      state.data.words.find((word) => word.id === state.selectedId),
      state.data.words
    );
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
  void exploreSearch(searchInput.value);
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
