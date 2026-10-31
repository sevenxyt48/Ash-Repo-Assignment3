import { readFile } from "node:fs/promises";
import {
  validateCandidateDataset,
  validateRelationshipRecords
} from "./relationshipValidation.mjs";

const wordsUrl = new URL("../data/words.json", import.meta.url);
const candidatesUrl = new URL("../data/candidate-relationships.json", import.meta.url);

try {
  const [wordData, candidateData] = await Promise.all([
    readFile(wordsUrl, "utf8").then(JSON.parse),
    readFile(candidatesUrl, "utf8").then(JSON.parse)
  ]);
  const wordIds = new Set();
  const wordErrors = [];
  for (const word of wordData.words) {
    if (!word.id || wordIds.has(word.id)) {
      wordErrors.push(`Invalid or duplicate word id "${word.id ?? ""}"`);
    }
    if (!["zh", "ja", "ko"].includes(word.language)) {
      wordErrors.push(`Word "${word.id ?? ""}" has an unsupported language`);
    }
    wordIds.add(word.id);
  }
  const allLocalRelationships = wordData.words.flatMap((word) => word.connections);
  const existingRelationships = allLocalRelationships.filter(
    (relationship) => relationship.verificationStatus !== "demo"
  );
  const existingErrors = validateRelationshipRecords(existingRelationships, wordData.words);
  if (allLocalRelationships.some((relationship) =>
    ["candidate", "demo"].includes(relationship.verificationStatus))) {
    wordErrors.push("Candidate and demo relationships must stay outside the production word dataset");
  }
  const candidateErrors = validateCandidateDataset(
    candidateData,
    wordData.words,
    existingRelationships
  );
  const errors = [...wordErrors, ...existingErrors, ...candidateErrors];
  if (errors.length) {
    console.error("Candidate relationship validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Candidate relationships valid: ${candidateData.relationships.length}`);
    console.log("No candidate has been promoted or treated as verified.");
  }
} catch (error) {
  console.error(`Unable to audit candidate relationships: ${error.message}`);
  process.exitCode = 1;
}
