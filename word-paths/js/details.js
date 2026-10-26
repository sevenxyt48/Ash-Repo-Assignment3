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
  if (language === "zh") return `Pinyin · ${word.pinyin}`;
  if (language === "ja") return `Romaji · ${word.romanization.ja}`;
  if (language === "ko") return `Romanization · ${word.romanization.ko}`;
  return `English · ${word.translations.en}`;
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
    ? data.relationshipTypes[relation.type]
    : "Center word";
  const type = element("span", "detail-type");
  type.append(element("i", ""), document.createTextNode(relationType));
  top.append(type, element("span", "detail-language", LANGUAGE_NAMES[language]));
  card.append(top);

  card.append(element("h2", "detail-word", word.translations[language] ?? word.translations.en));
  card.append(element("p", "detail-reading", readingFor(word, language)));
  card.append(element("p", "detail-meaning", word.meaning));

  if (relation) {
    const section = element("section", "detail-section");
    section.append(
      element("h3", "", "Why these words connect"),
      element("p", "relation-copy", relation.explanation)
    );
    card.append(section);
  } else {
    const translations = element("section", "detail-section");
    translations.append(element("h3", "", "Also known as"));
    for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
      const row = element("div", "translation-row");
      row.append(element("span", "", name));
      const value = element("strong", "", word.translations[code]);
      if (code === "zh" && language !== "zh") {
        value.append(element("span", "translation-reading", `Pinyin · ${word.pinyin}`));
      }
      row.append(value);
      translations.append(row);
    }
    card.append(translations);
  }

  if (connections.length) {
    const section = element("section", "detail-section");
    section.append(element("h3", "", "Follow a connection"));
    const chips = element("div", "connection-list");
    for (const connection of connections) {
      const chip = element("button", "connection-chip");
      chip.type = "button";
      chip.append(document.createTextNode(connection.word.translations[language] ?? connection.word.translations.en));
      chip.addEventListener("click", () => onSelect(connection.word.id, connection));
      chips.append(chip);
    }
    section.append(chips);
    card.append(section);
  }

  container.replaceChildren(card);
}
