// 此文件封装 ConceptNet 关系查询和 MyMemory 英译，并缓存成功结果。
const SUPPORTED_LANGUAGES = new Set(["zh", "ja", "ko"]);
const conceptCache = new Map();
const translationCache = new Map();
const TRANSLATION_LANGUAGES = {
  zh: "zh-CN",
  ja: "ja",
  en: "en",
  ko: "ko"
};
const REQUEST_TIMEOUT_MS = 15000;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`API request failed: HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`API request timed out after ${REQUEST_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function conceptLanguage(uri) {
  return new URL(uri, "https://api.conceptnet.io").pathname.split("/")[2];
}

function conceptUrl(uri) {
  const path = new URL(uri, "https://api.conceptnet.io").pathname;
  return `https://api.conceptnet.io${path}`;
}

function conceptLabel(concept) {
  if (!isRecord(concept)) return null;
  const label = concept.label?.trim();
  if (!label || !concept["@id"]) return null;
  const language = conceptLanguage(concept["@id"]);
  if (!SUPPORTED_LANGUAGES.has(language)) return null;
  return { id: conceptUrl(concept["@id"]), label, language };
}

function conceptSource(edge) {
  const licenseId = edge.license?.["@id"] ??
    (typeof edge.license === "string" ? edge.license : "CC BY-SA 4.0");
  const license = licenseId.startsWith("cc:")
    ? `https://creativecommons.org/licenses/${licenseId.slice(3)}/`
    : licenseId;
  return {
    label: "ConceptNet",
    url: edge["@id"] ? conceptUrl(edge["@id"]) : "https://api.conceptnet.io/",
    dataset: edge.dataset,
    license,
    licenseId,
    sources: Array.isArray(edge.sources) ? edge.sources : []
  };
}

function normalizeConceptResponse(term, language, payload) {
  if (!isRecord(payload) || !Array.isArray(payload.edges)) {
    throw new Error("ConceptNet response must include an edges array");
  }

  const rootEndpoint = payload.edges.flatMap((edge) => [edge?.start, edge?.end])
    .find((concept) => conceptLanguage(concept?.["@id"] ?? "") === language &&
      concept.label?.trim().toLocaleLowerCase() === term.toLocaleLowerCase());
  const rootId = rootEndpoint?.["@id"] ??
    `/c/${language}/${encodeURIComponent(term.toLocaleLowerCase().replace(/\s+/g, "_"))}`;
  const rootUri = conceptUrl(rootId);
  const words = new Map();
  const relationshipTypes = {
    equivalent: "Cross-language equivalent",
    origin: "Word origin",
    similar: "Similar meaning",
    confusable: "Easily confused",
    antonym: "Antonym"
  };
  const edgeKeys = new Set();
  const root = {
    id: rootUri,
    word: term,
    translations: { [language]: term },
    language,
    englishTranslation: null,
    meaning: `ConceptNet concept: ${term}`,
    romanization: {},
    source: { label: "ConceptNet", url: rootUri },
    verificationStatus: "unverified",
    connections: [],
  };
  words.set(root.id, root);

  function getWord(concept) {
    const endpoint = conceptLabel(concept);
    if (!endpoint) return null;
    if (!words.has(endpoint.id)) {
      words.set(endpoint.id, {
        id: endpoint.id,
        word: endpoint.label,
        translations: { [endpoint.language]: endpoint.label },
        language: endpoint.language,
        englishTranslation: null,
        meaning: `ConceptNet concept: ${endpoint.label}`,
        romanization: {},
        source: { label: "ConceptNet", url: endpoint.id },
        verificationStatus: "unverified",
        connections: [],
      });
    }
    return words.get(endpoint.id);
  }

  for (const edge of payload.edges) {
    if (!isRecord(edge) || !isRecord(edge.rel) || typeof edge.rel.label !== "string") continue;
    const start = getWord(edge.start);
    const end = getWord(edge.end);
    if (!start || !end) continue;

    const rawRelationType = edge.rel.label;
    const key = `${start.id}\u0000${end.id}\u0000${rawRelationType}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);

    const source = conceptSource(edge);
    start.connections.push({
      id: edge["@id"] ?? key,
      sourceWordId: start.id,
      targetWordId: end.id,
      rawRelationType,
      productRelationType: null,
      directionality: "directed",
      description: `Unverified ConceptNet relation: ${rawRelationType}`,
      source,
      verificationStatus: "candidate",
      metadata: {
        weight: typeof edge.weight === "number" ? edge.weight : null,
        dataset: edge.dataset,
        license: source.license,
        edgeUri: edge["@id"]
      }
    });
  }

  return {
    words: [...words.values()],
    relationshipTypes,
    queryMatched: Boolean(rootEndpoint)
  };
}

export async function fetchConceptNetWord(term, language, { fetchImpl = fetch } = {}) {
  const cleanedTerm = term.trim();
  if (!cleanedTerm) throw new Error("A word is required for ConceptNet lookup");
  if (!SUPPORTED_LANGUAGES.has(language)) throw new Error(`Unsupported ConceptNet language: ${language}`);

  const cacheKey = `${language}:${cleanedTerm.toLocaleLowerCase()}`;
  if (conceptCache.has(cacheKey)) return conceptCache.get(cacheKey);

  const url = new URL("/api/conceptnet", window.location.origin);
  url.searchParams.set("language", language);
  url.searchParams.set("term", cleanedTerm);
  const request = fetchJson(url, fetchImpl).then((payload) => {
    const dataset = normalizeConceptResponse(cleanedTerm, language, payload);
    conceptCache.set(cacheKey, dataset);
    console.info("ConceptNet lookup", {
      term: cleanedTerm,
      language,
      nodes: dataset.words.length,
      queryMatched: dataset.queryMatched,
      relationships: [...new Set(dataset.words.flatMap((word) =>
        word.connections.map((item) => item.rawRelationType)))],
      sources: [...new Set(dataset.words.flatMap((word) => word.connections.map((item) => item.source.label)))]
    });
    return dataset;
  }).catch((error) => {
    conceptCache.delete(cacheKey);
    throw error;
  });
  conceptCache.set(cacheKey, request);
  return request;
}

export async function translateText(text, sourceLanguage, targetLanguage = "en", { fetchImpl = fetch } = {}) {
  const cleanedText = text.trim();
  if (!cleanedText) throw new Error("Text is required for translation");
  if (!Object.prototype.hasOwnProperty.call(TRANSLATION_LANGUAGES, sourceLanguage) ||
      !Object.prototype.hasOwnProperty.call(TRANSLATION_LANGUAGES, targetLanguage)) {
    throw new Error(`Unsupported translation language: ${sourceLanguage}`);
  }
  if (sourceLanguage === targetLanguage) return cleanedText;

  const cacheKey = `${sourceLanguage}:${targetLanguage}:${cleanedText.toLocaleLowerCase()}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  const parameters = new URLSearchParams({
    q: cleanedText,
    langpair: `${TRANSLATION_LANGUAGES[sourceLanguage]}|${TRANSLATION_LANGUAGES[targetLanguage]}`
  });
  const request = fetchJson(
    `https://api.mymemory.translated.net/get?${parameters.toString()}`,
    fetchImpl
  ).then((payload) => {
    const translatedText = payload?.responseData?.translatedText?.trim();
    if (payload?.responseStatus !== 200 || !translatedText) {
      throw new Error(`MyMemory translation failed: ${payload?.responseDetails ?? "empty response"}`);
    }
    translationCache.set(cacheKey, translatedText);
    return translatedText;
  }).catch((error) => {
    translationCache.delete(cacheKey);
    throw error;
  });
  translationCache.set(cacheKey, request);
  return request;
}
