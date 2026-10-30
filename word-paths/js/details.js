// 此文件根据当前词条和语言渲染词语详情及关系来源状态。
import { formatVocabularyWord, languageName, translate } from "./i18n.js";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readingFor(word, language) {
  if (word.language === "zh" && word.pinyin) return `${translate(language, "details.pinyin")} · ${word.pinyin}`;
  if (word.language === "ja" && word.romanization.ja) return `${translate(language, "details.romaji")} · ${word.romanization.ja}`;
  if (word.language === "ko" && word.romanization.ko) return `${translate(language, "details.romanization")} · ${word.romanization.ko}`;
  return "";
}

function definitionFor(word, language) {
  const definition = word.definitions?.[language];
  if (definition) return definition;
  if (language === "en") return word.definitions?.en ?? word.meaning;
  return translate(language, "details.meaningUnavailable");
}

function partOfSpeechFor(word, language) {
  const value = word.partsOfSpeech?.[language] ??
    (language === "en" ? word.partsOfSpeech?.en : undefined);
  return Array.isArray(value) ? value.join(" · ") : value;
}

export function renderEmptyDetails(container, language) {
  const empty = element("div", "detail-empty");
  const sparkle = element("span", "detail-sparkle", "✳");
  sparkle.setAttribute("aria-hidden", "true");
  empty.append(sparkle);
  const copy = element("div", "");
  copy.append(
    element("h2", "", translate(language, "details.emptyTitle")),
    element("p", "", translate(language, "details.emptyCopy"))
  );
  empty.append(copy);
  container.replaceChildren(empty);
}

export function renderDetails(container, word, data, language, relation, connections, onSelect) {
  if (!word) return;
  const card = element("div", "detail-card");
  const top = element("div", "detail-topline");
  const rawRelationType = relation?.productRelationType;
  const translatedRelationType = rawRelationType
    ? translate(language, `relationship.${rawRelationType}`)
    : relation?.rawRelationType
      ? translate(language, "relationship.rawType", { type: relation.rawRelationType })
      : null;
  const relationType = relation
    ? translatedRelationType?.startsWith("relationship.")
      ? data.relationshipTypes[rawRelationType] ?? rawRelationType
      : translatedRelationType ?? translate(language, "details.center")
    : translate(language, "details.center");
  const type = element("span", "detail-type");
  type.append(element("i", ""), document.createTextNode(relationType));
  top.append(type, element("span", "detail-language", languageName(word.language, language)));
  card.append(top);

  card.append(element("h2", "detail-word", formatVocabularyWord(word)));
  const reading = readingFor(word, language);
  if (reading) card.append(element("p", "detail-reading", reading));
  const partOfSpeech = partOfSpeechFor(word, language);
  if (partOfSpeech) card.append(element("p", "detail-pos", partOfSpeech));
  card.append(element("p", "detail-meaning", definitionFor(word, language) ?? word.meaning));

  if (relation) {
    const section = element("section", "detail-section");
    section.append(
      element("h3", "", translate(language, "details.reason")),
      element("p", "relation-copy", relation.verificationStatus === "demo"
        ? translate(language, "details.demoDescription")
        : relation.verificationStatus === "unverified" && !relation.productRelationType
          ? translate(language, "details.unverifiedRawDescription", {
              type: relation.rawRelationType
            })
        : relation.description)
    );
    const status = relation.verificationStatus === "verified"
      ? translate(language, "details.verified")
      : relation.verificationStatus === "demo"
        ? translate(language, "details.demo")
        : translate(language, "details.unverified");
    const sourceLabel = relation.source?.label ?? translate(language, "details.sourceMissing");
    const licenseLabel = relation.source?.licenseId?.startsWith("cc:")
      ? `CC ${relation.source.licenseId.slice(3).replace("/", " ").toUpperCase()}`
      : relation.source?.license;
    const license = licenseLabel ? ` · ${licenseLabel}` : "";
    const dataset = relation.source?.dataset
      ? ` · ${[].concat(relation.source.dataset).join(", ")}`
      : "";
    const sources = relation.source?.sources
      ?.map((source) => [source.contributor, source.activity, source.process].filter(Boolean).join(" / "))
      .filter(Boolean)
      .join("; ");
    const sourceDetails = sources ? ` · ${sources}` : "";
    const provenance = element(
      "p",
      "relation-provenance",
      `${status} · ${sourceLabel}${license}${dataset}${sourceDetails}`
    );
    if (relation.source?.license && licenseLabel) {
      const link = element("a", "", licenseLabel);
      link.href = relation.source.license;
      link.target = "_blank";
      link.rel = "noreferrer";
      provenance.replaceChildren(
        document.createTextNode(`${status} · ${sourceLabel} · `),
        link,
        document.createTextNode(`${dataset}${sourceDetails}`)
      );
    }
    if (relation.source?.url) {
      const link = element("a", "", translate(language, "details.viewEdge"));
      link.href = relation.source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      provenance.append(document.createTextNode(" · "), link);
    }
    section.append(provenance);
    card.append(section);
  } else {
    const translations = element("section", "detail-section");
    translations.append(element("h3", "", translate(language, "details.alsoKnown")));
    for (const [code, value] of Object.entries(word.translations).filter(([code]) => code !== "en")) {
      const name = languageName(code, language);
      const row = element("div", "translation-row");
      row.append(element("span", "", name));
      const translation = element("strong", "", value);
      if (code === "zh" && language !== "zh") {
        if (word.pinyin) translation.append(element("span", "translation-reading",
          `${translate(language, "details.pinyin")} · ${word.pinyin}`));
      }
      row.append(translation);
      translations.append(row);
    }
    card.append(translations);
  }

  if (word.source) {
    const attribution = element("p", "relation-provenance", `${word.source.label} · `);
    if (word.source.license === "CC BY-SA 4.0") {
      const licenseLink = element("a", "", word.source.license);
      licenseLink.href = "https://creativecommons.org/licenses/by-sa/4.0/";
      licenseLink.target = "_blank";
      licenseLink.rel = "noreferrer";
      attribution.append(licenseLink);
    } else {
      attribution.append(document.createTextNode(word.source.license ?? translate(language, "details.sourceData")));
    }
    const link = element("a", "", translate(language, "details.viewSource"));
    link.href = word.source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    attribution.append(document.createTextNode(" · "), link);
    card.append(attribution);
  }

  if (connections.length) {
    const section = element("section", "detail-section");
    section.append(element("h3", "", translate(language, "details.follow")));
    const chips = element("div", "connection-list");
    for (const connection of connections) {
      const chip = element("button", "connection-chip");
      chip.type = "button";
      const relationshipLabel = translate(language, `relationship.${connection.productRelationType}`);
      chip.append(document.createTextNode(
        `${connection.word.word} (${languageName(connection.word.language, language)}) · ${
          relationshipLabel.startsWith("relationship.")
            ? data.relationshipTypes[connection.productRelationType] ?? connection.productRelationType
            : relationshipLabel
        }`
      ));
      chip.addEventListener("click", () => onSelect(connection.word.id, connection));
      chips.append(chip);
    }
    section.append(chips);
    card.append(section);
  }

  container.replaceChildren(card);
}
