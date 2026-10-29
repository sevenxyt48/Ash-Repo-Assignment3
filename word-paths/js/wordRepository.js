// 此文件负责加载并校验本地词汇数据及归一化后的 API 词汇数据。
const LANGUAGE_CODES = ["zh", "ja", "ko", "en"];
const LOCAL_RELATIONSHIP_TYPES = ["origin", "similar", "confusable", "antonym"];
const VERIFICATION_STATUSES = ["unverified", "verified"];
const LOCAL_DATA_URL = new URL("../data/words.json", import.meta.url);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateWordDataset(data) {
  if (!isRecord(data) || !Array.isArray(data.words) || !isRecord(data.relationshipTypes)) {
    throw new Error("Word dataset must include relationshipTypes and a words array");
  }
  for (const type of LOCAL_RELATIONSHIP_TYPES) {
    if (!Object.prototype.hasOwnProperty.call(data.relationshipTypes, type) ||
        typeof data.relationshipTypes[type] !== "string" || !data.relationshipTypes[type]) {
      throw new Error(`Word dataset is missing the "${type}" relationship label`);
    }
  }
  for (const [type, label] of Object.entries(data.relationshipTypes)) {
    if (typeof label !== "string" || !label) {
      throw new Error(`Relationship label for "${type}" must be non-empty text`);
    }
  }
  if (data.words.length === 0) throw new Error("Word dataset is empty");

  const wordIds = new Set();
  for (const word of data.words) {
    if (!isRecord(word) || typeof word.id !== "string" || !word.id) {
      throw new Error("Each word must have a non-empty id");
    }
    if (wordIds.has(word.id)) throw new Error(`Duplicate word id "${word.id}"`);
    wordIds.add(word.id);

    if (!isRecord(word.translations) || !isRecord(word.romanization) || typeof word.meaning !== "string") {
      throw new Error(`Word "${word.id}" must include translations, readings, and an English meaning`);
    }
    if (word.language !== undefined) {
      if (!LANGUAGE_CODES.includes(word.language) ||
          typeof word.translations[word.language] !== "string" || !word.translations[word.language]) {
        throw new Error(`API word "${word.id}" must include a translation in its source language`);
      }
      for (const [language, translation] of Object.entries(word.translations)) {
        if (!LANGUAGE_CODES.includes(language) || typeof translation !== "string" || !translation) {
          throw new Error(`Translation for "${word.id}" must use a supported language code`);
        }
      }
      if (word.source !== undefined && (!isRecord(word.source) ||
          typeof word.source.label !== "string" || typeof word.source.url !== "string")) {
        throw new Error(`Word source for "${word.id}" must include a label and URL`);
      }
    } else {
      for (const language of LANGUAGE_CODES) {
        if (typeof word.translations[language] !== "string" || !word.translations[language]) {
          throw new Error(`Word "${word.id}" is missing its ${language} translation`);
        }
      }
      if (typeof word.pinyin !== "string" || !word.pinyin) {
        throw new Error(`Word "${word.id}" is missing Chinese pinyin`);
      }
      for (const language of ["ja", "ko"]) {
        if (typeof word.romanization[language] !== "string" || !word.romanization[language]) {
          throw new Error(`Word "${word.id}" is missing its ${language} reading`);
        }
      }
    }
    if (!Array.isArray(word.connections)) {
      throw new Error(`Word "${word.id}" must include a connections array`);
    }
    if (word.definitions !== undefined && !isRecord(word.definitions)) {
      throw new Error(`Definitions for "${word.id}" must be keyed by language`);
    }
    if (word.partsOfSpeech !== undefined && !isRecord(word.partsOfSpeech)) {
      throw new Error(`Parts of speech for "${word.id}" must be keyed by language`);
    }
    for (const [language, definition] of Object.entries(word.definitions ?? {})) {
      if (!LANGUAGE_CODES.includes(language) || typeof definition !== "string") {
        throw new Error(`Definition for "${word.id}" must be text keyed by a supported language`);
      }
    }
    for (const [language, partOfSpeech] of Object.entries(word.partsOfSpeech ?? {})) {
      const validValue = typeof partOfSpeech === "string" ||
        (Array.isArray(partOfSpeech) && partOfSpeech.every((item) => typeof item === "string"));
      if (!LANGUAGE_CODES.includes(language) || !validValue) {
        throw new Error(`Part of speech for "${word.id}" must be text keyed by a supported language`);
      }
    }
  }

  for (const word of data.words) {
    for (const connection of word.connections) {
      if (!isRecord(connection) || !wordIds.has(connection.target)) {
        throw new Error(`Word "${word.id}" references an invalid connection target`);
      }
      if (typeof connection.type !== "string" ||
          !Object.prototype.hasOwnProperty.call(data.relationshipTypes, connection.type)) {
        throw new Error(`Word "${word.id}" has an unsupported relationship type`);
      }
      if (!VERIFICATION_STATUSES.includes(connection.verificationStatus)) {
        throw new Error(`Relationship from "${word.id}" is missing a valid verification status`);
      }
      if (typeof connection.explanation !== "string" || !connection.explanation) {
        throw new Error(`Relationship from "${word.id}" is missing an explanation`);
      }
      if (!Object.prototype.hasOwnProperty.call(connection, "source")) {
        throw new Error(`Relationship from "${word.id}" is missing its source field`);
      }
      if (connection.source !== null &&
          (!isRecord(connection.source) || typeof connection.source.label !== "string" ||
           (connection.source.url !== undefined && typeof connection.source.url !== "string"))) {
        throw new Error(`Relationship source for "${word.id}" must be null or include a label`);
      }
      if (connection.verificationStatus === "verified" && connection.source === null) {
        throw new Error(`Verified relationship from "${word.id}" must include its source`);
      }
      if (connection.source !== null && connection.source !== undefined) {
        for (const field of ["dataset", "license"]) {
          const value = connection.source[field];
          const validValue = typeof value === "string" ||
            (Array.isArray(value) && value.every((item) => typeof item === "string"));
          if (value !== undefined && !validValue) {
            throw new Error(`Relationship ${field} for "${word.id}" must be text`);
          }
        }
      }
      if (connection.weight !== undefined &&
          connection.weight !== null && typeof connection.weight !== "number") {
        throw new Error(`Relationship weight for "${word.id}" must be numeric`);
      }
      if (connection.source?.sources !== undefined &&
          (!Array.isArray(connection.source.sources) ||
           !connection.source.sources.every(isRecord))) {
        throw new Error(`Relationship sources for "${word.id}" must be a list of source records`);
      }
    }
  }

  return data;
}

export async function loadWordDataset({ apiLoader } = {}) {
  if (apiLoader) {
    try {
      return validateWordDataset(await apiLoader());
    } catch (error) {
      console.warn("Dictionary provider unavailable or returned invalid data; using the local vocabulary.", error);
    }
  }

  const response = await fetch(LOCAL_DATA_URL);
  if (!response.ok) throw new Error(`Unable to load local vocabulary: HTTP ${response.status}`);
  return validateWordDataset(await response.json());
}
