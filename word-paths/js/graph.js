const SVG_NS = "http://www.w3.org/2000/svg";

const CATEGORY_POSITIONS = {
  nature: { x: 150, label: "NATURE" },
  time: { x: 383, label: "TIME" },
  emotion: { x: 616, label: "EMOTION" },
  journey: { x: 849, label: "JOURNEY" }
};

const CATEGORY_COLORS = {
  nature: "cat-nature",
  time: "cat-time",
  emotion: "cat-emotion",
  journey: "cat-journey"
};

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function getPositions(words) {
  const groups = new Map();
  for (const word of words) {
    if (!groups.has(word.category)) groups.set(word.category, []);
    groups.get(word.category).push(word);
  }

  const positions = new Map();
  for (const [category, group] of groups) {
    const centerX = CATEGORY_POSITIONS[category]?.x ?? 500;
    const span = Math.min(290, (group.length - 1) * 80);
    const gap = group.length > 1 ? span / (group.length - 1) : 0;
    const startY = 105 + (290 - span) / 2;
    group.forEach((word, index) => {
      positions.set(word.id, { x: centerX, y: startY + index * gap });
    });
  }
  return positions;
}

function addEdge(svg, source, target, type) {
  const line = svgElement("line", {
    x1: source.x,
    y1: source.y,
    x2: target.x,
    y2: target.y,
    class: `graph-edge edge-${type}`,
    "data-source": source.id,
    "data-target": target.id
  });
  svg.append(line);
}

function addNode(svg, word, point, language, selectedId, query, onSelect) {
  const group = svgElement("g", {
    class: "graph-node",
    transform: `translate(${point.x} ${point.y})`,
    tabindex: "0",
    role: "button",
    "aria-label": `${word.translations[language]} — ${word.meaning}`,
    "aria-pressed": String(word.id === selectedId),
    "data-id": word.id
  });
  const halo = svgElement("circle", { r: "37", class: "node-halo" });
  const core = svgElement("circle", {
    r: "29",
    class: `node-core ${CATEGORY_COLORS[word.category] ?? ""}`
  });
  const text = svgElement("text", { class: "node-label" });
  text.textContent = word.translations[language] ?? word.translations.zh;
  group.append(halo, core, text);

  if (word.id === selectedId) group.classList.add("is-selected");
  if (query) {
    const searchable = [
      ...Object.values(word.translations),
      word.pinyin,
      ...Object.values(word.romanization),
      word.meaning
    ].join(" ").toLocaleLowerCase();
    if (searchable.includes(query)) group.classList.add("is-match");
    else group.classList.add("is-dimmed");
  }

  group.addEventListener("click", () => onSelect(word.id));
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(word.id);
    }
  });
  svg.append(group);
}

export function renderGraph(container, words, options) {
  const { language, category, selectedId, query, onSelect } = options;
  const visibleWords = category === "all"
    ? words
    : words.filter((word) => word.category === category);
  const visibleIds = new Set(visibleWords.map((word) => word.id));
  const positions = getPositions(visibleWords);
  const wordById = new Map(words.map((word) => [word.id, word]));
  const svg = svgElement("svg", {
    viewBox: "0 0 1000 440",
    role: "group",
    "aria-label": "词语及其语义关系"
  });

  for (const [id, position] of Object.entries(CATEGORY_POSITIONS)) {
    if (category !== "all" && category !== id) continue;
    const label = svgElement("text", {
      x: position.x,
      y: "54",
      class: "category-label"
    });
    label.textContent = position.label;
    svg.append(label);
  }

  const seenEdges = new Set();
  for (const word of visibleWords) {
    for (const connection of word.connections) {
      if (!visibleIds.has(connection.target)) continue;
      const pair = [word.id, connection.target].sort().join(":");
      if (seenEdges.has(pair)) continue;
      seenEdges.add(pair);
      const target = wordById.get(connection.target);
      if (target) {
        addEdge(svg, { ...positions.get(word.id), id: word.id }, {
          ...positions.get(target.id), id: target.id
        }, connection.type);
      }
    }
  }

  for (const word of visibleWords) {
    addNode(svg, word, positions.get(word.id), language, selectedId, query, onSelect);
  }
  container.replaceChildren(svg);
  return visibleWords;
}
