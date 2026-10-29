// 此文件根据当前词条和语言渲染词语详情及关系来源状态。
const LANGUAGE_NAMES = {
  zh: "Chinese",
  en: "English",
  ja: "Japanese",
  ko: "Korean"
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readingFor(word, language) {
  if (word.language) return `${LANGUAGE_NAMES[word.language]} · ${word.translations[word.language]}`;
  if (language === "zh") return `Pinyin · ${word.pinyin}`;
  if (language === "ja") return `Romaji · ${word.romanization.ja}`;
  if (language === "ko") return `Romanization · ${word.romanization.ko}`;
  return `English · ${word.translations.en}`;
}

function definitionFor(word, language) {
  return word.definitions?.[language] ?? word.definitions?.en ?? word.meaning;
}

function partOfSpeechFor(word, language) {
  const value = word.partsOfSpeech?.[language] ?? word.partsOfSpeech?.en;
  return Array.isArray(value) ? value.join(" · ") : value;
}

export function renderEmptyDetails(container) {
  const empty = element("div", "detail-empty");
  const sparkle = element("span", "detail-sparkle", "✳");
  sparkle.setAttribute("aria-hidden", "true");
  empty.append(sparkle);
  const copy = element("div", "");
  copy.append(
    element("h2", "", "A word to begin with"),
    element("p", "", "Choose a word on the map to see its meaning and follow a connection.")
  );
  empty.append(copy);
  container.replaceChildren(empty);
}

export function renderDetails(container, word, data, language, relation, connections, onSelect) {
  if (!word) return;
  const card = element("div", "detail-card");
  const top = element("div", "detail-topline");
  const relationType = relation
    ? data.relationshipTypes[relation.type] ?? relation.type
    : "Center word";
  const type = element("span", "detail-type");
  type.append(element("i", ""), document.createTextNode(relationType));
  top.append(type, element("span", "detail-language", LANGUAGE_NAMES[language]));
  card.append(top);

  const wordLabel = word.translations[language] ?? word.translations[word.language] ?? word.translations.en ?? word.id;
  card.append(element("h2", "detail-word", wordLabel));
  const reading = readingFor(word, language);
  if (reading) card.append(element("p", "detail-reading", reading));
  const partOfSpeech = partOfSpeechFor(word, language);
  if (partOfSpeech) card.append(element("p", "detail-pos", partOfSpeech));
  card.append(element("p", "detail-meaning", definitionFor(word, language) ?? word.meaning));

  if (relation) {
    const section = element("section", "detail-section");
    section.append(
      element("h3", "", "Why these words connect"),
      element("p", "relation-copy", relation.explanation)
    );
    const status = relation.verificationStatus === "verified" ? "Source verified" : "Unverified";
    const sourceLabel = relation.source?.label ?? "Source not attached";
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
      const link = element("a", "", "View edge");
      link.href = relation.source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      provenance.append(document.createTextNode(" · "), link);
    }
    section.append(provenance);
    card.append(section);
  } else {
    const translations = element("section", "detail-section");
    translations.append(element("h3", "", "Also known as"));
    for (const [code, value] of Object.entries(word.translations)) {
      const name = LANGUAGE_NAMES[code];
      const row = element("div", "translation-row");
      row.append(element("span", "", name));
      const translation = element("strong", "", value);
      if (code === "zh" && language !== "zh") {
        if (word.pinyin) translation.append(element("span", "translation-reading", `Pinyin · ${word.pinyin}`));
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
      attribution.append(document.createTextNode(word.source.license ?? "Source data"));
    }
    const link = element("a", "", "View source");
    link.href = word.source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    attribution.append(document.createTextNode(" · "), link);
    card.append(attribution);
  }

  if (connections.length) {
    const section = element("section", "detail-section");
    section.append(element("h3", "", "Follow a connection"));
    const chips = element("div", "connection-list");
    for (const connection of connections) {
      const chip = element("button", "connection-chip");
      chip.type = "button";
      chip.append(document.createTextNode(
        connection.word.translations[language] ??
        connection.word.translations[connection.word.language] ??
        connection.word.translations.en ??
        connection.word.id
      ));
      chip.addEventListener("click", () => onSelect(connection.word.id, connection));
      chips.append(chip);
    }
    section.append(chips);
    card.append(section);
  }

  container.replaceChildren(card);
}
