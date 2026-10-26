const LANGUAGE_NAMES = {
  zh: "中文",
  en: "English",
  ja: "日本語",
  ko: "한국어"
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function getReading(word, language) {
  if (language === "zh") return `拼音 · ${word.pinyin}`;
  if (language === "ja") return word.romanization.ja;
  if (language === "ko") return word.romanization.ko;
  return "English";
}

export function renderEmptyDetails(container) {
  const empty = element("div", "empty-detail");
  const sparkle = element("span", "detail-sparkle", "✳");
  sparkle.setAttribute("aria-hidden", "true");
  empty.append(sparkle);
  empty.append(element("p", "eyebrow", "YOUR NEXT WORD"));
  empty.append(element("h2", "", "从地图开始"));
  empty.append(element("p", "", "选择一个节点，发现它的读音、释义与相连的词语。"));
  const path = element("div", "empty-path");
  path.setAttribute("aria-hidden", "true");
  path.append(element("span", ""));
  path.append(element("i", ""));
  path.append(element("span", ""));
  empty.append(path);
  container.replaceChildren(empty);
}

export function renderDetails(container, word, data, language, onSelect) {
  if (!word) return;
  const card = element("div", "detail-card");
  card.append(element("span", "detail-category", data.categories[word.category]));
  card.append(element("h2", "detail-word", word.translations[language]));
  card.append(element("p", "detail-romanization", getReading(word, language)));
  card.append(element("p", "detail-meaning", word.meaning));

  const translations = element("div", "translation-list");
  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    const row = element("div", "translation-row");
    row.append(element("span", "", name));
    row.append(element("strong", "", word.translations[code]));
    translations.append(row);
  }
  card.append(translations);
  card.append(element("h3", "connections-title", "沿着这些词继续"));

  const chips = element("div", "connection-list");
  for (const connection of word.connections) {
    const connectedWord = data.words.find((item) => item.id === connection.target);
    if (!connectedWord) continue;
    const chip = element("button", "connection-chip");
    chip.type = "button";
    chip.append(document.createTextNode(connectedWord.translations[language]));
    chip.append(element("span", "connection-type", data.relationshipTypes[connection.type]));
    chip.addEventListener("click", () => onSelect(connectedWord.id));
    chips.append(chip);
  }
  card.append(chips);
  container.replaceChildren(card);
}
