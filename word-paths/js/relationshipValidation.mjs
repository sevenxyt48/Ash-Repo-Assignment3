export const RELATIONSHIP_TYPES = [
  "equivalent",
  "origin",
  "similar",
  "confusable",
  "antonym"
];

export const RELATIONSHIP_STATUSES = [
  "candidate",
  "verified",
  "demo",
  "rejected"
];

export function relationshipIdentityKey(relationship) {
  const { sourceWordId, targetWordId, productRelationType, directionality } = relationship;
  const endpoints = directionality === "symmetric"
    ? [sourceWordId, targetWordId].sort()
    : [sourceWordId, targetWordId];
  return `${endpoints[0]}\u0000${endpoints[1]}\u0000${productRelationType ?? relationship.rawRelationType}`;
}

export function validateRelationshipRecords(relationships, words, existing = []) {
  const errors = [];
  if (!Array.isArray(relationships) || !Array.isArray(words) || !Array.isArray(existing)) {
    return ["Relationships, words, and existing relationships must be arrays"];
  }

  const wordsById = new Map(words.map((word) => [word.id, word]));
  const relationshipIds = new Set();
  const identities = new Set();

  for (const relationship of existing) {
    if (relationship?.id) relationshipIds.add(relationship.id);
    if (relationship?.sourceWordId && relationship?.targetWordId) {
      identities.add(relationshipIdentityKey(relationship));
    }
  }

  for (const relationship of relationships) {
    const label = typeof relationship?.id === "string" && relationship.id
      ? `Relationship "${relationship.id}"`
      : "Relationship";
    if (!relationship || typeof relationship !== "object" || Array.isArray(relationship)) {
      errors.push("Each relationship must be an object");
      continue;
    }
    if (typeof relationship.id !== "string" || !relationship.id) {
      errors.push("Each relationship must have a non-empty id");
    } else if (relationshipIds.has(relationship.id)) {
      errors.push(`Duplicate relationship id "${relationship.id}"`);
    } else {
      relationshipIds.add(relationship.id);
    }

    const source = wordsById.get(relationship.sourceWordId);
    const target = wordsById.get(relationship.targetWordId);
    if (!source || !target) {
      errors.push(`${label} references a missing word id`);
    } else if (source.id === target.id) {
      errors.push(`${label} cannot connect a word to itself`);
    }
    if (source && !["zh", "ja", "ko"].includes(source.language)) {
      errors.push(`${label} has an unsupported source language`);
    }
    if (target && !["zh", "ja", "ko"].includes(target.language)) {
      errors.push(`${label} has an unsupported target language`);
    }

    if (typeof relationship.rawRelationType !== "string" || !relationship.rawRelationType) {
      errors.push(`${label} is missing rawRelationType`);
    }
    const productType = relationship.productRelationType;
    if (productType !== null && !RELATIONSHIP_TYPES.includes(productType)) {
      errors.push(`${label} has an unsupported productRelationType`);
    }
    if (!RELATIONSHIP_STATUSES.includes(relationship.verificationStatus)) {
      errors.push(`${label} has an unsupported verificationStatus`);
    }
    if (!["directed", "symmetric"].includes(relationship.directionality)) {
      errors.push(`${label} must declare directionality as directed or symmetric`);
    } else if (productType === "origin" && relationship.directionality !== "directed") {
      errors.push(`${label} origin relationships must be directed`);
    } else if (productType && productType !== "origin" &&
        relationship.directionality !== "symmetric") {
      errors.push(`${label} ${productType} relationships must be symmetric`);
    }
    if (productType === "equivalent" && source && target &&
        source.language === target.language) {
      errors.push(`${label} cross-language equivalents must connect different languages`);
    }
    if (relationship.verificationStatus === "verified" && !productType) {
      errors.push(`${label} cannot be verified without a productRelationType`);
    }
    if (relationship.verificationStatus === "demo" && !productType) {
      errors.push(`${label} demo fixture must declare a productRelationType`);
    }
    if (!relationship.source || typeof relationship.source !== "object" ||
        typeof relationship.source.label !== "string" || !relationship.source.label ||
        (relationship.verificationStatus !== "demo" &&
         (typeof relationship.source.url !== "string" || !relationship.source.url))) {
      errors.push(`${label} requires a source label and a source URL unless it is demo data`);
    }
    if (typeof relationship.description !== "string" || !relationship.description) {
      errors.push(`${label} requires a non-empty description or review note`);
    }
    if (relationship.source && typeof relationship.source === "object") {
      for (const field of ["dataset", "license"]) {
        const value = relationship.source[field];
        const validValue = typeof value === "string" ||
          (Array.isArray(value) && value.every((item) => typeof item === "string"));
        if (value !== undefined && !validValue) {
          errors.push(`${label} source ${field} must be text`);
        }
      }
      if (relationship.source.sources !== undefined &&
          (!Array.isArray(relationship.source.sources) ||
           !relationship.source.sources.every((item) =>
             item !== null && typeof item === "object" && !Array.isArray(item)))) {
        errors.push(`${label} source sources must be a list of records`);
      }
    }
    if (relationship.metadata !== undefined && relationship.metadata !== null &&
        (typeof relationship.metadata !== "object" || Array.isArray(relationship.metadata))) {
      errors.push(`${label} metadata must be an object or null`);
    }

    if (source && target && relationship.rawRelationType &&
        (productType === null || RELATIONSHIP_TYPES.includes(productType)) &&
        ["directed", "symmetric"].includes(relationship.directionality)) {
      const identity = relationshipIdentityKey(relationship);
      if (identities.has(identity)) {
        errors.push(`${label} duplicates an existing relationship between the same endpoints and type`);
      } else {
        identities.add(identity);
      }
    }
  }

  return errors;
}

export function validateCandidateDataset(dataset, words, existing = []) {
  if (!dataset || typeof dataset !== "object" || !Array.isArray(dataset.relationships)) {
    return ["Candidate dataset must include a relationships array"];
  }
  const candidates = dataset.relationships;
  const errors = validateRelationshipRecords(candidates, words, existing);
  for (const relationship of candidates) {
    if (relationship?.verificationStatus !== "candidate") {
      errors.push(`Candidate file relationship "${relationship?.id ?? "(missing id)"}" must have candidate status`);
    }
  }
  return errors;
}
