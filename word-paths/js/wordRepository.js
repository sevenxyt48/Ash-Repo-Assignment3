const LANGUAGE_CODES = ["zh", "ja", "ko", "en"];
const RELATIONSHIP_TYPES = ["origin", "similar", "confusable", "antonym"];
const VERIFICATION_STATUSES = ["unverified", "verified"];
const LOCAL_DATA_URL = new URL("../data/words.json", import.meta.url);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateWordDataset(data) {
  if (!isRecord(data) || !Array.isArray(data.words) || !isRecord(data.relationshipTypes)) {
    throw new Error("Word dataset must include relationshipTypes and a words array");
  }
  for (const type of RELATIONSHIP_TYPES) {
    if (typeof data.relationshipTypes[type] !== "string" || !data.relationshipTypes[type]) {
      throw new Error(`Word dataset is missing the "${type}" relationship label`);
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
      if (!RELATIONSHIP_TYPES.includes(connection.type)) {
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
