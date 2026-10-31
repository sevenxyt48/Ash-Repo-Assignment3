// 此文件协调页面状态、搜索、筛选、词汇仓库和关系图渲染。
import { renderGraph, resetGraphView, zoomGraph } from "./graph.js";
import { renderDetails, renderEmptyDetails } from "./details.js";
import { loadWordDataset, validateWordDataset } from "./wordRepository.js";
import { relationshipIdentityKey } from "./relationshipValidation.mjs";
import { fetchConceptNetWord, translateText } from "./vocabularyApi.js";
import { enrichKrdictWord, enrichWiktionaryWord } from "./sourceApi.js";
import {
  applyInterfaceLanguage,
  formatVocabularyWord,
  languageName,
  translate
} from "./i18n.js";

const graphContainer = document.querySelector("#graph");
const graphMessage = document.querySelector("#graph-message");
const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search");
const searchMessage = document.querySelector("#search-message");
const searchCandidates = document.querySelector("#search-candidates");
const searchLanguageOptions = [...document.querySelectorAll("[data-search-language-option]")];
const languageSelect = document.querySelector("#language");
const randomButton = document.querySelector("#random");
const detailsPanel = document.querySelector("#details");
const resultCount = document.querySelector("#result-count");
const datasetStats = document.querySelector("#dataset-stats");
const developmentNotice = document.querySelector("#development-notice");
const trail = document.querySelector("#trail");
const trailBack = document.querySelector("#trail-back");
const trailSteps = document.querySelector("#trail-steps");
const filters = [...document.querySelectorAll("[data-filter]")];
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const developmentGraph = localHosts.has(window.location.hostname) &&
  new URLSearchParams(window.location.search).get("devGraph") === "1";

const state = {
  data: null,
  localData: null,
  language: "zh",
  selectedId: null,
  selectedRelation: null,
  trail: [],
  languageHint: null,
  activeTypes: new Set(["equivalent", "origin", "similar", "confusable", "antonym"]),
  query: "",
  searchRequest: 0,
  searchMessage: null,
  searchCandidates: [],
  searchCandidateHandler: null,
  sourceEnrichments: {},
  sourceLookupLoading: new Set(),
  sourceLookupErrors: {},
  developmentGraph
};

function normalized(value) {
  return value.trim().toLocaleLowerCase();
}

function wordSearchTerms(word) {
  return [word.englishTranslation, word.translations.en, word.pinyin,
    word.reading, ...Object.values(word.romanization)].filter(Boolean).map(normalized);
}

function getConnections(word, activeTypes = state.activeTypes, data = state.data,
  includeDemo = state.developmentGraph, activeLanguages = selectedSearchLanguages()) {
  if (!word || !data) return [];
  const connections = new Map();
  const wordIds = new Set(data.words.map((candidate) => candidate.id));
  for (const item of data.words) {
    for (const connection of item.connections) {
      const hasProductType = connection.productRelationType &&
        Object.prototype.hasOwnProperty.call(data.relationshipTypes, connection.productRelationType);
      if ((!includeDemo && connection.verificationStatus !== "verified") ||
          (includeDemo &&
           !["verified", "demo"].includes(connection.verificationStatus)) ||
          !hasProductType ||
          !activeTypes.has(connection.productRelationType)) continue;
      const isOutgoing = item.id === word.id;
      const isIncomingSymmetric = connection.targetWordId === word.id &&
        connection.directionality === "symmetric";
      if (!isOutgoing && !isIncomingSymmetric) continue;
      const targetId = isOutgoing ? connection.targetWordId : item.id;
      if (!wordIds.has(targetId)) continue;
      const target = data.words.find((candidate) => candidate.id === targetId);
      if (!target || !activeLanguages.has(target.language)) continue;
      const key = `${targetId}\u0000${connection.productRelationType ?? connection.rawRelationType}`;
      if (connections.has(key)) continue;
      if (item.id === word.id) {
        connections.set(key, { ...connection, word: target });
      } else {
        connections.set(key, {
          ...connection,
          targetWordId: item.id,
          word: target
        });
      }
    }
  }
  return [...connections.values()];
}

function countDisplayableRelationships(data) {
  const wordIds = new Set(data.words.map((word) => word.id));
  const relationshipIds = new Map();
  const counts = { total: 0, verified: 0, equivalents: 0, semantic: 0 };
  for (const word of data.words) {
    for (const connection of word.connections) {
      if (connection.verificationStatus === "verified" &&
          connection.productRelationType &&
          Object.prototype.hasOwnProperty.call(data.relationshipTypes, connection.productRelationType) &&
          connection.sourceWordId === word.id &&
          wordIds.has(connection.targetWordId)) {
        relationshipIds.set(relationshipIdentityKey(connection), connection.verificationStatus);
      }
    }
  }
  for (const [key, status] of relationshipIds) {
    counts[status] += 1;
    const type = key.slice(key.lastIndexOf("\u0000") + 1);
    if (type === "equivalent") counts.equivalents += 1;
    else counts.semantic += 1;
  }
  counts.total = relationshipIds.size;
  return counts;
}

function countDemoRelationships(data) {
  const wordIds = new Set(data.words.map((word) => word.id));
  const relationshipIds = new Set();
  for (const word of data.words) {
    for (const connection of word.connections) {
      if (connection.verificationStatus !== "demo" ||
          connection.sourceWordId !== word.id ||
          !connection.productRelationType ||
          !Object.prototype.hasOwnProperty.call(data.relationshipTypes, connection.productRelationType) ||
          !wordIds.has(connection.targetWordId)) continue;
      relationshipIds.add(relationshipIdentityKey(connection));
    }
  }
  return relationshipIds.size;
}

async function addDemoRelationships(data) {
  const response = await fetch(new URL("../data/demo-relationships.json", import.meta.url));
  if (!response.ok) throw new Error(`Unable to load development graph fixtures: HTTP ${response.status}`);
  const fixture = await response.json();
  if (!Array.isArray(fixture.relationships) || fixture.relationships.length < 6 ||
      !fixture.relationships.every((relationship) => relationship.verificationStatus === "demo")) {
    throw new Error("Development graph fixtures must include at least six demo relationships");
  }
  const words = new Map(data.words.map((word) => [word.id, {
    ...word,
    connections: [...word.connections]
  }]));
  const relationshipIdentities = new Set(
    data.words.flatMap((word) =>
      word.connections.map((relationship) => relationshipIdentityKey(relationship)))
  );
  const duplicateFixtureIds = [];
  // Fixture relationship categories only exercise the existing filters; they are not linguistic claims.
  for (const relationship of fixture.relationships) {
    const source = words.get(relationship.sourceWordId);
    if (!source || !words.has(relationship.targetWordId)) {
      throw new Error(`Demo relationship "${relationship.id}" references an unknown word`);
    }
    const identity = relationshipIdentityKey(relationship);
    if (relationshipIdentities.has(identity)) {
      duplicateFixtureIds.push(relationship.id);
      continue;
    }
    source.connections.push(relationship);
    relationshipIdentities.add(identity);
  }
  if (duplicateFixtureIds.length) {
    console.warn(`Skipped duplicate demo relationships: ${duplicateFixtureIds.join(", ")}`);
  }
  return validateWordDataset({ ...data, words: [...words.values()] });
}

function wordById(id) {
  return state.data?.words.find((word) => word.id === id) ?? null;
}

function resetSearchUi() {
  state.searchRequest += 1;
  state.query = "";
  searchInput.value = "";
  updateSearchLanguageOptions("");
  showMessage("");
  clearSearchCandidates();
}

function selectWord(id, relation = null, replaceTrail = false) {
  if (!replaceTrail && id === state.selectedId) {
    state.selectedRelation = relation ?? state.selectedRelation;
    state.languageHint = null;
    render();
    return;
  }
  state.trail = replaceTrail || !state.trail.length
    ? [{ id, relation }]
    : [...state.trail, { id, relation }];
  state.selectedId = id;
  state.selectedRelation = relation;
  state.languageHint = null;
  resetSearchUi();
  render();
}

function selectTrailStep(index) {
  const step = state.trail[index];
  if (!step || index === state.trail.length - 1) return;
  state.trail = state.trail.slice(0, index + 1);
  state.selectedId = step.id;
  state.selectedRelation = step.relation ?? null;
  state.languageHint = null;
  resetSearchUi();
  render();
}

function findLanguageVariant(word, code) {
  if (!word?.translations?.[code] || code === word.language) return null;
  const candidates = state.data.words.filter((candidate) =>
    candidate.language === code && candidate.word === word.translations[code]);
  if (word.conceptId) {
    const conceptMatch = candidates.find((candidate) =>
      candidate.conceptId && candidate.conceptId === word.conceptId);
    if (conceptMatch) return conceptMatch;
  }
  return candidates[0] ?? null;
}

function languageAvailabilityFor(word) {
  return Object.fromEntries(["zh", "ja", "ko"].map((code) =>
    [code, Boolean(findLanguageVariant(word, code))]));
}

function languageDetailsFor(word) {
  const details = {};
  for (const code of ["zh", "ja", "ko"]) {
    const variant = findLanguageVariant(word, code);
    details[code] = {
      reading: code === "ja"
        ? variant?.reading ?? null
        : code === "zh"
          ? variant?.pinyin ?? word.pinyin ?? null
          : null,
      honorific: code === "ko"
        ? variant?.honorific ?? variant?.honorificForm ?? null
        : null
    };
  }
  return details;
}

function switchLanguage(code) {
  const selected = wordById(state.selectedId);
  if (!selected || code === selected.language) return;
  const target = findLanguageVariant(selected, code);
  if (!target) {
    state.languageHint = { wordId: selected.id, language: code };
    render();
    return;
  }
  const relation = getConnections(selected,
    new Set(Object.keys(state.data.relationshipTypes)), state.data, state.developmentGraph,
    new Set(["zh", "ja", "ko"]))
    .find((connection) => connection.word.id === target.id) ?? null;
  selectWord(target.id, relation);
}

function renderTrail() {
  const steps = state.trail;
  trail.hidden = steps.length <= 1;
  trailBack.disabled = steps.length <= 1;
  trailSteps.replaceChildren();
  steps.forEach((step, index) => {
    const word = wordById(step.id);
    if (!word) return;
    if (index) {
      const separator = document.createElement("span");
      separator.className = "trail-sep";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "→";
      trailSteps.append(separator);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = `trail-step${index === steps.length - 1 ? " is-current" : ""}`;
    button.textContent = word.word;
    button.title = `${formatVocabularyWord(word)} · ${languageName(word.language, state.language)}`;
    if (index === steps.length - 1) button.setAttribute("aria-current", "true");
    button.addEventListener("click", () => selectTrailStep(index));
    trailSteps.append(button);
  });
}

function render() {
  const selected = state.data.words.find((word) => word.id === state.selectedId);
  if (!selected) return;

  const activeLanguages = selectedSearchLanguages();
  renderGraph(graphContainer, state.data.words, {
    language: state.language,
    selectedId: state.selectedId,
    query: state.query,
    activeTypes: state.activeTypes,
    activeLanguages,
    developmentGraph: state.developmentGraph,
    relationshipTypes: state.data.relationshipTypes,
    onSelect: selectWord,
    onHover: (word) => word.englishTranslation
      ? Promise.resolve(word.englishTranslation)
      : translateText(word.word, word.language, "en")
  });
  const displayableConnections = getConnections(selected,
    new Set(Object.keys(state.data.relationshipTypes)), state.data, state.developmentGraph,
    activeLanguages);
  const matchingConnections = getConnections(selected, state.activeTypes, state.data,
    state.developmentGraph, activeLanguages);
  graphMessage.hidden = matchingConnections.length > 0;
  if (displayableConnections.length === 0) {
    graphMessage.textContent = translate(state.language,
      state.developmentGraph ? "graph.noDevelopmentRelationships" : "graph.noVerified");
  } else if (matchingConnections.length === 0) {
    graphMessage.textContent = translate(state.language, "graph.noFiltered");
  }

  const connectionCount = matchingConnections.length;
  resultCount.textContent = displayableConnections.length === 0
    ? translate(state.language,
      state.developmentGraph ? "search.noDevelopmentRelationships" : "search.noVerified")
    : connectionCount === 0
      ? translate(state.language, "search.noFiltered")
      : translate(state.language, connectionCount === 1 ? "search.focusRelationsOne" : "search.focusRelations", {
          count: connectionCount
        });
  const datasetRelationshipCounts = countDisplayableRelationships(state.data);
  const formattedWordCount = new Intl.NumberFormat(state.language).format(state.data.words.length);
  const formatCount = (count) => new Intl.NumberFormat(state.language).format(count);
  datasetStats.textContent = translate(state.language, "search.datasetStats", {
    words: formattedWordCount,
    relations: formatCount(datasetRelationshipCounts.total),
    verified: formatCount(datasetRelationshipCounts.verified),
    equivalents: formatCount(datasetRelationshipCounts.equivalents),
    semantic: formatCount(datasetRelationshipCounts.semantic)
  });
  if (state.developmentGraph) {
    const formattedDemoCount = new Intl.NumberFormat(state.language)
      .format(countDemoRelationships(state.data));
    datasetStats.textContent += ` · ${translate(state.language, "search.demoStats", {
      count: formattedDemoCount
    })}`;
  }

  const relation = state.selectedRelation
    ? {
        ...state.selectedRelation,
        word: undefined
      }
    : null;
  const languageHint = state.languageHint?.wordId === selected.id
    ? translate(state.language, "details.languageUnavailable", {
        language: languageName(state.languageHint.language, state.language)
      })
    : null;
  renderTrail();
  renderDetails(
    detailsPanel,
    selected,
    state.data,
    state.language,
    relation,
    matchingConnections,
    selectWord,
    state.sourceEnrichments[selected.id] ?? {},
    state.sourceLookupLoading,
    state.sourceLookupErrors,
    lookupSource,
    switchLanguage,
    languageAvailabilityFor(selected),
    languageHint,
    languageDetailsFor(selected)
  );
}

async function lookupSource(wordId, provider) {
  const key = `${wordId}:${provider}`;
  state.sourceLookupErrors[key] = null;
  state.sourceLookupLoading.add(key);
  render();
  try {
    const result = provider === "krdict"
      ? await enrichKrdictWord(wordId)
      : await enrichWiktionaryWord(wordId);
    state.sourceEnrichments[wordId] = {
      ...state.sourceEnrichments[wordId],
      [provider]: result
    };
  } catch (error) {
    state.sourceLookupErrors[key] = error.message;
    console.error(`${provider} lookup failed for ${wordId}:`, error);
  } finally {
    state.sourceLookupLoading.delete(key);
    render();
  }
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

function selectedSearchLanguages() {
  return new Set(searchLanguageOptions
    .filter((option) => option.querySelector("input").checked)
    .map((option) => option.dataset.searchLanguageOption));
}

function lockedSearchLanguages(query) {
  const detectedLanguages = query ? queryLanguages(query) : [];
  if (detectedLanguages.length !== 2 ||
      !/\p{Script=Han}/u.test(query) ||
      !state.localData) return new Set(detectedLanguages);

  const term = normalized(query);
  const matchingLanguages = new Set(state.localData.words
    .filter((word) => detectedLanguages.includes(word.language) &&
      normalized(word.word).startsWith(term))
    .map((word) => word.language));
  return matchingLanguages.size === 1
    ? matchingLanguages
    : new Set(detectedLanguages);
}

function updateSearchLanguageOptions(query) {
  const detectedLanguages = lockedSearchLanguages(query);
  for (const option of searchLanguageOptions) {
    const input = option.querySelector("input");
    const isLocked = detectedLanguages.has(input.value);
    if (query && isLocked) input.checked = true;
    input.disabled = isLocked;
    option.classList.toggle("is-selected", input.checked);
    option.classList.toggle("is-locked", isLocked);
    option.querySelector(".search-language-lock").hidden = !isLocked;
  }
}

function findMatchesIn(query, data) {
  const term = normalized(query);
  if (!term) return [];
  const selectedLanguages = selectedSearchLanguages();
  const detectedLanguages = queryLanguages(query);
  const languages = detectedLanguages.length
    ? detectedLanguages.filter((language) => selectedLanguages.has(language))
    : [...selectedLanguages];
  return data.words.filter((word) => {
    if (languages.length) {
      return languages.includes(word.language) &&
        [word.word, word.language === "ja" ? word.reading : null]
          .filter(Boolean)
          .some((candidate) => normalized(candidate).startsWith(term));
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
    label.textContent = formatVocabularyWord(word);
    const language = document.createElement("span");
    language.className = "search-candidate-language";
    language.textContent = `${languageName(word.language, state.language)} (${word.language})`;
    option.append(label, language);
    option.addEventListener("click", () => onSelect(word));
    searchCandidates.append(option);
  }
  searchCandidates.hidden = words.length === 0;
}

function updateDevelopmentNotice() {
  developmentNotice.hidden = !state.developmentGraph;
  if (state.developmentGraph) {
    developmentNotice.textContent = translate(state.language, "graph.developmentNotice");
  }
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

function selectSearchCandidate(word, dataset = state.data ?? state.localData) {
  if (dataset) state.data = dataset;
  state.selectedId = word.id;
  state.selectedRelation = null;
  state.trail = [{ id: word.id, relation: null }];
  state.languageHint = null;
  state.query = "";
  searchInput.value = "";
  updateSearchLanguageOptions("");
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
  const matches = findMatchesIn(query, state.localData);
  const languages = queryLanguages(query)
    .filter((language) => selectedSearchLanguages().has(language));
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
    showMessage("search.noResults");
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
    const matchedRemoteDatasets = remoteDatasets.filter((dataset) => dataset.queryMatched !== false);
    if (matchedRemoteDatasets.length === 0) {
      if (matches.length) {
        renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
        showMessage(results.some((result) => result.status === "rejected")
          ? "search.lookupPartial"
          : "search.noResults", results.some((result) => result.status === "rejected"));
      } else {
        showMessage(results.some((result) => result.status === "rejected")
          ? "search.apiFailed"
          : "search.noResults", results.some((result) => result.status === "rejected"));
      }
      return;
    }
    const datasets = [state.localData, ...matchedRemoteDatasets];
    let data = mergeWordDatasets(datasets);
    if (state.developmentGraph) data = await addDemoRelationships(data);
    state.data = data;
    validateWordDataset(state.data);
    for (const type of Object.keys(state.data.relationshipTypes)) state.activeTypes.add(type);
    const selectedLanguages = selectedSearchLanguages();
    const candidates = [...new Map([
      ...matches,
      ...matchedRemoteDatasets.map((dataset) => dataset.words[0])
    ].filter((word) => selectedLanguages.has(word.language))
      .map((word) => [word.id, word])).values()];
    if (candidates.length === 1 && languages.length === 1) {
      selectSearchCandidate(candidates[0], data);
      return;
    }
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
      renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
      showMessage("search.lookupPartial", true);
      return;
    }
    showMessage("search.apiFailed", true);
  }
}

async function initialize() {
  try {
    state.localData = await loadWordDataset();
    state.data = state.developmentGraph
      ? await addDemoRelationships(state.localData)
      : state.localData;
    updateDevelopmentNotice();
    state.selectedId = state.developmentGraph
      ? "water-zh"
      : state.data.words[Math.floor(Math.random() * state.data.words.length)].id;
    state.trail = [{ id: state.selectedId, relation: null }];
    render();
  } catch (error) {
    console.error("Unable to load the word graph:", error);
    graphMessage.hidden = false;
    graphMessage.textContent = translate(state.language, "load.failed");
    resultCount.textContent = translate(state.language, "search.datasetUnavailable");
    datasetStats.textContent = translate(state.language, "search.datasetUnavailable");
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
  const languagesBefore = [...selectedSearchLanguages()].join(",");
  updateSearchLanguageOptions(query);
  if (state.data && [...selectedSearchLanguages()].join(",") !== languagesBefore) render();
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
  const matches = findMatchesIn(query, state.data ?? state.localData);
  renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
  if (matches.length > 1) {
    showMessage("search.multiple", false, { count: matches.length });
  } else if (matches.length === 1) {
    showMessage("search.one", false, { language: languageName(matches[0].language, state.language) });
  } else {
    showMessage("search.pressEnter");
  }
});

for (const option of searchLanguageOptions) {
  const input = option.querySelector("input");
  input.addEventListener("change", () => {
    if (input.disabled) {
      input.checked = true;
      return;
    }
    option.classList.toggle("is-selected", input.checked);
    if (state.data) render();
    const query = searchInput.value.trim();
    if (!query || !state.localData) return;
    const matches = findMatchesIn(query, state.data ?? state.localData);
    renderSearchCandidates(matches, (word) => selectSearchCandidate(word));
    if (matches.length > 1) {
      showMessage("search.multiple", false, { count: matches.length });
    } else if (matches.length === 1) {
      showMessage("search.one", false, {
        language: languageName(matches[0].language, state.language)
      });
    } else {
      showMessage("search.pressEnter");
    }
  });
}

languageSelect.addEventListener("change", () => {
  state.language = languageSelect.value;
  applyInterfaceLanguage(state.language);
  updateDevelopmentNotice();
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

randomButton.addEventListener("click", () => {
  if (!state.data || randomButton.classList.contains("is-spinning")) return;
  randomButton.classList.add("is-spinning");
  const choices = state.data.words.filter((word) => word.id !== state.selectedId);
  const pool = choices.length ? choices : state.data.words;
  window.setTimeout(() => {
    randomButton.classList.remove("is-spinning");
    selectWord(pool[Math.floor(Math.random() * pool.length)].id, null, true);
  }, 420);
});

trailBack.addEventListener("click", () => {
  if (state.trail.length > 1) selectTrailStep(state.trail.length - 2);
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
    updateSearchLanguageOptions("");
    showMessage("");
    clearSearchCandidates();
    searchInput.blur();
  }
});

languageSelect.value = state.language;
applyInterfaceLanguage(state.language);
initialize();
