// 此文件协调页面状态、搜索、筛选、词汇仓库和关系图渲染。
import { renderGraph, resetGraphView, zoomGraph } from "./graph.js";
import { renderDetails, renderEmptyDetails } from "./details.js";
import { loadWordDataset, validateWordDataset } from "./wordRepository.js";
import { fetchConceptNetWord, translateText } from "./vocabularyApi.js";
import { applyInterfaceLanguage, languageName, translate } from "./i18n.js";

const graphContainer = document.querySelector("#graph");
const graphMessage = document.querySelector("#graph-message");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search");
const searchMessage = document.querySelector("#search-message");
const searchCandidates = document.querySelector("#search-candidates");
const languageSelect = document.querySelector("#language");
const randomButton = document.querySelector("#random");
const detailsPanel = document.querySelector("#details");
const resultCount = document.querySelector("#result-count");
const filters = [...document.querySelectorAll("[data-filter]")];
const otherLanguagesButton = document.querySelector("#other-languages");

const state = {
  data: null,
  localData: null,
  language: "zh",
  selectedId: null,
  selectedRelation: null,
  activeTypes: new Set(["origin", "similar", "confusable", "antonym"]),
  otherLanguages: false,
  query: "",
  apiEmpty: false,
  apiError: false,
  searchRequest: 0,
  searchMessage: null,
  searchCandidates: [],
  searchCandidateHandler: null
};

function normalized(value) {
  return value.trim().toLocaleLowerCase();
}

function wordSearchTerms(word) {
  return [word.englishTranslation, word.translations.en, word.pinyin,
    ...Object.values(word.romanization)].filter(Boolean).map(normalized);
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
  state.searchRequest += 1;
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
  showMessage("");
  clearSearchCandidates();
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
    graphMessage.textContent = translate(state.language, "graph.noVerified");
  } else if (state.apiError) {
    graphMessage.textContent = translate(state.language, "graph.serviceUnavailable");
  }

  const connectionCount = graphResult.edgeCount;
  resultCount.textContent = state.apiEmpty
    ? translate(state.language, "search.noVerified")
    : connectionCount
    ? translate(state.language, connectionCount === 1 ? "search.resultCountOne" : "search.resultCount", {
        nodes: graphResult.nodeCount,
        count: connectionCount
      })
    : translate(state.language, "search.noFiltered");

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

function showMessage(key, isError = false, values = {}) {
  state.searchMessage = key ? { key, values, isError } : null;
  searchMessage.textContent = key ? translate(state.language, key, values) : "";
  searchMessage.classList.toggle("is-error", isError);
}

function queryLanguages(query) {
  if (/\p{Script=Hangul}/u.test(query)) return ["ko"];
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(query)) return ["ja"];
  if (/\p{Script=Han}/u.test(query)) return ["zh", "ja"];
  return [];
}

function findMatchesIn(query, data) {
  const term = normalized(query);
  if (!term) return [];
  const languages = queryLanguages(query);
  return data.words.filter((word) => {
    if (languages.length) {
      return languages.includes(word.language) && normalized(word.word).startsWith(term);
    }
    return wordSearchTerms(word).some((candidate) => candidate.startsWith(term));
  });
}

function findMatches(query) {
  return findMatchesIn(query, state.localData);
}

function clearSearchCandidates() {
  state.searchCandidates = [];
  state.searchCandidateHandler = null;
  searchCandidates.replaceChildren();
  searchCandidates.hidden = true;
}

function renderSearchCandidates(words, onSelect) {
  state.searchCandidates = words;
  state.searchCandidateHandler = onSelect;
  searchCandidates.replaceChildren();
  for (const word of words) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "search-candidate";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    const label = document.createElement("span");
    label.className = "search-candidate-word";
    label.textContent = word.word;
    const language = document.createElement("span");
    language.className = "search-candidate-language";
    language.textContent = `${languageName(word.language, state.language)} (${word.language})`;
    option.append(label, language);
    option.addEventListener("click", () => onSelect(word));
    searchCandidates.append(option);
  }
  searchCandidates.hidden = words.length === 0;
}

function mergeWordDatasets(datasets) {
  const words = new Map();
  const relationshipTypes = {};
  for (const dataset of datasets) {
    Object.assign(relationshipTypes, dataset.relationshipTypes);
    for (const word of dataset.words) {
      const current = words.get(word.id);
      if (!current) {
        words.set(word.id, { ...word, connections: [...word.connections] });
        continue;
      }
      const connections = new Map(current.connections.map((item) => [item.id, item]));
      for (const connection of word.connections) connections.set(connection.id, connection);
      words.set(word.id, { ...current, ...word, connections: [...connections.values()] });
    }
  }
  return { words: [...words.values()], relationshipTypes };
}

function selectSearchCandidate(word, dataset = state.localData) {
  state.data = dataset;
  state.selectedId = word.id;
  state.selectedRelation = null;
  state.apiEmpty = !hasVerifiedConnections(word, dataset.words);
  state.apiError = false;
  state.query = "";
  searchInput.value = "";
  showMessage("");
  clearSearchCandidates();
  render();
}

async function exploreSearch(query) {
  const requestId = ++state.searchRequest;
  const term = normalized(query);
  if (!term) return;
  if (!state.localData) {
    showMessage("search.loading", true);
    return;
  }
  clearSearchCandidates();
  state.data = state.localData;
  state.apiEmpty = false;
  state.apiError = false;
  const matches = findMatchesIn(query, state.localData);
  const languages = queryLanguages(query);
  if (matches.length > 0 && languages.length < 2) {
    if (matches.length === 1) {
      selectSearchCandidate(matches[0]);
      return;
    }
    renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
    showMessage("search.choose");
    return;
  }
  const missingLanguages = languages.filter((language) =>
    !matches.some((word) => word.language === language)
  );
  if (matches.length > 0 && missingLanguages.length === 0) {
    renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
    showMessage("search.choose");
    return;
  }
  if (languages.length === 0) {
    showMessage("search.unsupported", true);
    return;
  }
  const languagesToSearch = languages.length > 1 ? missingLanguages : languages;
  showMessage("search.searching", false, {
    languages: languagesToSearch.map((language) => languageName(language, state.language)).join(", ")
  });
  try {
    const results = await Promise.allSettled(
      languagesToSearch.map((language) => fetchConceptNetWord(query, language))
    );
    if (requestId !== state.searchRequest) return;
    const remoteDatasets = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    if (remoteDatasets.length === 0) {
      const failure = results.find((result) => result.status === "rejected");
      throw failure.reason;
    }
    const datasets = [state.localData, ...remoteDatasets];
    const data = mergeWordDatasets(datasets);
    state.data = data;
    validateWordDataset(state.data);
    for (const type of Object.keys(state.data.relationshipTypes)) state.activeTypes.add(type);
    const candidates = [...new Map([
      ...matches,
      ...remoteDatasets.map((dataset) => dataset.words[0])
    ].map((word) => [word.id, word])).values()];
    if (candidates.length === 1 && languages.length === 1) {
      selectSearchCandidate(candidates[0], data);
      return;
    }
    state.apiEmpty = true;
    state.apiError = false;
    graphMessage.hidden = true;
    renderSearchCandidates(candidates, (word) => selectSearchCandidate(word, data));
    showMessage(results.some((result) => result.status === "rejected")
      ? "search.partial"
      : "search.choose");
    state.selectedId = candidates[0].id;
    state.selectedRelation = null;
    render();
  } catch (error) {
    if (requestId !== state.searchRequest) return;
    console.error("ConceptNet lookup failed:", error);
    if (matches.length > 0) {
      state.data = state.localData;
      state.apiEmpty = false;
      state.apiError = false;
      state.selectedId = matches[0].id;
      state.selectedRelation = null;
      renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
      render();
      showMessage("search.lookupPartial", true);
      return;
    }
    state.data = state.localData;
    state.apiEmpty = false;
    state.apiError = true;
    if (!state.localData.words.some((word) => word.id === state.selectedId)) {
      state.selectedId = state.localData.words[0].id;
      state.selectedRelation = null;
    }
    render();
    resultCount.textContent = translate(state.language, "search.conceptNetUnavailable");
    showMessage("search.failed", true);
  }
}

async function initialize() {
  try {
    state.data = await loadWordDataset();
    state.localData = state.data;
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
    graphMessage.textContent = translate(state.language, "load.failed");
    resultCount.textContent = translate(state.language, "search.datasetUnavailable");
    renderEmptyDetails(detailsPanel, state.language);
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void exploreSearch(searchInput.value);
});

searchInput.addEventListener("input", () => {
  state.searchRequest += 1;
  const query = searchInput.value.trim();
  if (!query) {
    showMessage("");
    clearSearchCandidates();
    return;
  }
  if (!state.localData) {
    clearSearchCandidates();
    showMessage("search.loadingInput");
    return;
  }
  const matches = findMatches(query);
  renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
  if (matches.length > 1) {
    showMessage("search.multiple", false, { count: matches.length });
  } else if (matches.length === 1) {
    showMessage("search.one", false, { language: languageName(matches[0].language, state.language) });
  } else {
    showMessage("search.pressEnter");
  }
});

languageSelect.addEventListener("change", () => {
  state.language = languageSelect.value;
  applyInterfaceLanguage(state.language);
  if (state.searchCandidates.length) {
    renderSearchCandidates(state.searchCandidates, state.searchCandidateHandler);
  }
  if (state.data) render();
  if (state.searchMessage) {
    searchMessage.textContent = translate(state.language, state.searchMessage.key, state.searchMessage.values);
    searchMessage.classList.toggle("is-error", state.searchMessage.isError);
  }
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
    state.searchRequest += 1;
    showMessage("");
    clearSearchCandidates();
    searchInput.blur();
  }
});

languageSelect.value = state.language;
applyInterfaceLanguage(state.language);
initialize();
