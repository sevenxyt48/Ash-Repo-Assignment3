// 此文件负责加载并校验本地词汇数据及归一化后的 API 词汇数据。
const DICTIONARY_LANGUAGES = ["zh", "ja", "ko"];
const TRANSLATION_LANGUAGES = [...DICTIONARY_LANGUAGES, "en"];
const PRODUCT_RELATIONSHIP_TYPES = ["origin", "similar", "confusable", "antonym"];
const VERIFICATION_STATUSES = ["unverified", "verified", "demo"];
const LOCAL_DATA_URL = new URL("../data/words.json", import.meta.url);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateWordDataset(data) {
  if (!isRecord(data) || !Array.isArray(data.words) || !isRecord(data.relationshipTypes)) {
    throw new Error("Word dataset must include relationshipTypes and a words array");
  }
  for (const type of PRODUCT_RELATIONSHIP_TYPES) {
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
    if (!isRecord(word) || typeof word.id !== "string" || !word.id ||
        typeof word.word !== "string" || !word.word) {
      throw new Error("Each word must have a non-empty id and word");
    }
    if (wordIds.has(word.id)) throw new Error(`Duplicate word id "${word.id}"`);
    wordIds.add(word.id);

    if (!DICTIONARY_LANGUAGES.includes(word.language)) {
      throw new Error(`Word "${word.id}" must use a supported dictionary language`);
    }
    if (Object.prototype.hasOwnProperty.call(word, "reading") &&
        (word.language !== "ja" ||
         (word.reading !== null &&
          (typeof word.reading !== "string" ||
           !/^[\u3041-\u3096\u3099-\u309f]+$/u.test(word.reading))))) {
      throw new Error(`Reading for "${word.id}" must be null or hiragana on a Japanese word`);
    }
    if (!isRecord(word.translations) || !isRecord(word.romanization) ||
        typeof word.meaning !== "string") {
      throw new Error(`Word "${word.id}" must include translations, readings, and a meaning`);
    }
    if (typeof word.translations[word.language] !== "string" ||
        word.translations[word.language] !== word.word) {
      throw new Error(`Word "${word.id}" must match its source-language translation`);
    }
    for (const [language, translation] of Object.entries(word.translations)) {
      if (!TRANSLATION_LANGUAGES.includes(language) || typeof translation !== "string" || !translation) {
        throw new Error(`Translation for "${word.id}" must use a supported language code`);
      }
    }
    if (!Object.prototype.hasOwnProperty.call(word, "englishTranslation") ||
        (word.englishTranslation !== null &&
         (typeof word.englishTranslation !== "string" || !word.englishTranslation ||
          word.translations.en !== word.englishTranslation))) {
      throw new Error(`English translation for "${word.id}" must be non-empty text or null`);
    }
    if (!VERIFICATION_STATUSES.includes(word.verificationStatus)) {
      throw new Error(`Word "${word.id}" is missing a valid verification status`);
    }
    if (!Object.prototype.hasOwnProperty.call(word, "source") ||
        (word.source !== null && (!isRecord(word.source) ||
        typeof word.source.label !== "string" || !word.source.label ||
        typeof word.source.url !== "string" || !word.source.url))) {
      throw new Error(`Word source for "${word.id}" must be null or include a label and URL`);
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
      if (!TRANSLATION_LANGUAGES.includes(language) || typeof definition !== "string") {
        throw new Error(`Definition for "${word.id}" must be text keyed by a supported language`);
      }
    }
    for (const [language, partOfSpeech] of Object.entries(word.partsOfSpeech ?? {})) {
      const validValue = typeof partOfSpeech === "string" ||
        (Array.isArray(partOfSpeech) && partOfSpeech.every((item) => typeof item === "string"));
      if (!TRANSLATION_LANGUAGES.includes(language) || !validValue) {
        throw new Error(`Part of speech for "${word.id}" must be text keyed by a supported language`);
      }
    }
  }

  const relationshipIds = new Set();
  for (const word of data.words) {
    for (const connection of word.connections) {
      if (!isRecord(connection) || typeof connection.id !== "string" || !connection.id ||
          connection.sourceWordId !== word.id ||
          !wordIds.has(connection.targetWordId)) {
        throw new Error(`Word "${word.id}" references an invalid connection target`);
      }
      if (relationshipIds.has(connection.id)) {
        throw new Error(`Duplicate relationship id "${connection.id}"`);
      }
      relationshipIds.add(connection.id);
      if (typeof connection.rawRelationType !== "string" || !connection.rawRelationType) {
        throw new Error(`Relationship "${connection.id}" is missing its raw relation type`);
      }
      if (connection.productRelationType !== null &&
          !PRODUCT_RELATIONSHIP_TYPES.includes(connection.productRelationType)) {
        throw new Error(`Relationship "${connection.id}" has an unsupported product relation type`);
      }
      if (!Object.prototype.hasOwnProperty.call(connection, "productRelationType")) {
        throw new Error(`Relationship "${connection.id}" is missing its product relation type`);
      }
      if (!VERIFICATION_STATUSES.includes(connection.verificationStatus)) {
        throw new Error(`Relationship "${connection.id}" is missing a valid verification status`);
      }
      if (connection.description !== null &&
          (typeof connection.description !== "string" || !connection.description)) {
        throw new Error(`Relationship "${connection.id}" must have a non-empty description or null`);
      }
      if (!isRecord(connection.source) || typeof connection.source.label !== "string" ||
          !connection.source.label ||
          (connection.verificationStatus !== "demo" &&
           (typeof connection.source.url !== "string" || !connection.source.url))) {
        throw new Error(`Relationship "${connection.id}" must include a source label and URL`);
      }
      if (connection.verificationStatus === "verified" && connection.productRelationType === null) {
        throw new Error(`Verified relationship "${connection.id}" must include a product relation type`);
      }
      for (const field of ["dataset", "license"]) {
        const value = connection.source[field];
        const validValue = typeof value === "string" ||
          (Array.isArray(value) && value.every((item) => typeof item === "string"));
        if (value !== undefined && !validValue) {
          throw new Error(`Relationship ${field} for "${word.id}" must be text`);
        }
      }
      if (connection.metadata !== undefined && connection.metadata !== null &&
          !isRecord(connection.metadata)) {
        throw new Error(`Relationship metadata for "${word.id}" must be an object`);
      }
      if (connection.source.sources !== undefined &&
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
