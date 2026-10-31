// 此文件计算词汇关系图布局并绘制可交互的 SVG 节点与连线。
import { formatVocabularyWord, languageName, translate } from "./i18n.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 560;
const TYPE_ORDER = ["equivalent", "origin", "similar", "confusable", "antonym"];
const viewport = { scale: 1, x: 0, y: 0 };
let ignoreClickUntil = 0;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function getConnections(word, words, activeTypes, developmentGraph, activeLanguages) {
  const byId = new Map(words.map((item) => [item.id, item]));
  const connections = new Map();
  for (const item of words) {
    for (const connection of item.connections) {
      if ((!developmentGraph &&
           connection.verificationStatus !== "verified") ||
          (developmentGraph &&
           !["verified", "demo"].includes(connection.verificationStatus)) ||
          !connection.productRelationType ||
          !activeTypes.has(connection.productRelationType)) continue;
      const isOutgoing = item.id === word.id;
      const isIncomingSymmetric = connection.targetWordId === word.id &&
        connection.directionality === "symmetric";
      if (!isOutgoing && !isIncomingSymmetric) continue;
      const targetId = isOutgoing ? connection.targetWordId : item.id;
      const key = `${targetId}\u0000${connection.productRelationType ?? connection.rawRelationType}`;
      if (connections.has(key)) continue;
      if (item.id === word.id) {
        connections.set(key, { ...connection, sourceId: word.id });
      } else {
        connections.set(key, {
          ...connection,
          targetWordId: item.id,
          sourceId: word.id
        });
      }
    }
  }
  return [...connections.values()]
    .map((connection) => ({ ...connection, word: byId.get(connection.targetWordId) }))
    .filter((connection) => connection.word &&
      (!activeLanguages || activeLanguages.has(connection.word.language)))
    .sort((a, b) =>
      TYPE_ORDER.indexOf(a.productRelationType) - TYPE_ORDER.indexOf(b.productRelationType));
}

function getLayout(center, words, activeTypes, developmentGraph, activeLanguages) {
  const visible = [{ word: center, x: 500, y: 280, depth: 0 }];
  const edges = [];
  const seen = new Set([center.id]);
  const firstLevelByWord = new Map();
  for (const connection of getConnections(center, words, activeTypes, developmentGraph,
    activeLanguages)) {
    const connections = firstLevelByWord.get(connection.word.id) ?? [];
    connections.push(connection);
    firstLevelByWord.set(connection.word.id, connections);
  }
  const firstLevel = [...firstLevelByWord.values()].slice(0, 6);

  firstLevel.forEach((connections, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const rowsOnSide = Math.ceil(firstLevel.length / 2);
    const y = 280 + (row - (rowsOnSide - 1) / 2) * 128;
    const connection = connections[0];
    const node = { word: connection.word, x: side < 0 ? 200 : 800, y, depth: 1, relation: connection };
    visible.push(node);
    seen.add(node.word.id);
    connections.forEach((item, connectionIndex) => {
      edges.push({
        from: visible[0],
        to: node,
        connection: {
          ...item,
          parallelOffset: (connectionIndex - (connections.length - 1) / 2) * 12
        }
      });
    });
  });

  const secondary = [];
  for (const parent of visible.slice(1)) {
    const next = getConnections(parent.word, words, activeTypes, developmentGraph,
      activeLanguages)
      .find((connection) => !seen.has(connection.word.id));
    if (next && secondary.length < 4) {
      seen.add(next.word.id);
      secondary.push({ parent, connection: next });
    }
  }

  secondary.forEach(({ parent, connection }, index) => {
    const side = parent.x < 500 ? -1 : 1;
    const offset = (index - (secondary.length - 1) / 2) * 92;
    const node = {
      word: connection.word,
      x: side < 0 ? 70 : 930,
      y: Math.max(86, Math.min(474, parent.y + offset)),
      depth: 2,
      relation: connection
    };
    visible.push(node);
    edges.push({ from: parent, to: node, connection });
  });

  return { nodes: visible, edges };
}

function nodePointFor(edge, endpoint) {
  const node = edge[endpoint];
  return { x: node.x, y: node.y };
}

function drawEdge(parent, from, to, connection, relationshipTypes, language, delay) {
  const direction = to.x >= from.x ? 1 : -1;
  const gap = Math.abs(to.x - from.x);
  const bend = Math.min(105, gap * .42);
  const parallelOffset = connection.parallelOffset ?? 0;
  const type = connection.productRelationType;
  const relationshipLabel = type
    ? translate(language, `relationship.${type}`)
    : translate(language, "relationship.rawType", { type: connection.rawRelationType });
  const baseLabel = relationshipLabel.startsWith("relationship.")
    ? relationshipTypes[type] ?? type ?? connection.rawRelationType
    : relationshipLabel;
  const statusLabel = connection.verificationStatus === "demo"
    ? translate(language, "relationship.demoMarker")
    : "";
  const labelText = [baseLabel, statusLabel].filter(Boolean).join(" · ");
  const path = svgElement("path", {
    d: `M ${from.x} ${from.y} C ${from.x + direction * bend} ${from.y + parallelOffset}, ${to.x - direction * bend} ${to.y + parallelOffset}, ${to.x} ${to.y}`,
    class: `graph-edge edge-${(type ?? "unclassified").replace(/[^a-z0-9_-]/gi, "-")}`,
    "data-source": connection.sourceId,
    "data-target": connection.targetWordId,
    "aria-label": labelText,
    style: `--edge-delay: ${delay}ms`
  });
  parent.append(path);
}

function addNode(parent, node, index, language, selectedId, query, onSelect, onHover) {
  const { word, x, y, depth } = node;
  const label = word.word;
  const delay = word.id === selectedId ? 0 : 90 + index * 55;
  const group = svgElement("g", {
    class: `graph-node${word.id === selectedId ? " is-center" : ""}${depth === 1 ? " is-connected" : ""}`,
    transform: `translate(${x} ${y})`,
    tabindex: "0",
    role: "button",
    "aria-pressed": String(word.id === selectedId),
    "data-id": word.id,
    style: `--node-delay: ${delay}ms; --float-delay: ${(index % 4) * .55}s`
  });
  const wordLanguageName = languageName(word.language, language);
  const reading = word.language === "ja"
    ? word.reading
    : word.language === "zh" ? word.pinyin : word.romanization[word.language];
  const nodeAriaLabel = `${formatVocabularyWord(word)}, ${wordLanguageName}${
    word.language !== "ja" && reading ? `, ${reading}` : ""
  }`;
  group.setAttribute("aria-label", nodeAriaLabel);

  group.append(
    svgElement("circle", { r: "37", class: "node-halo" }),
    svgElement("circle", { r: "31", class: "node-core" })
  );
  const text = svgElement("text", { y: "-3", class: "node-label" });
  text.textContent = label;
  group.append(text);

  if (word.language === "ja" && reading && reading !== word.word) {
    text.setAttribute("y", "-8");
    const pronunciation = svgElement("text", { y: "10", class: "node-pinyin" });
    pronunciation.textContent = `（${reading}）`;
    group.append(pronunciation);
  } else if (word.language !== "ja" && reading) {
    const pronunciation = svgElement("text", { y: "13", class: "node-pinyin" });
    pronunciation.textContent = reading;
    group.append(pronunciation);
  }

  const languageLabel = svgElement("text", { y: "25", class: "node-language" });
  languageLabel.textContent = { zh: "中文", ja: "日本語", ko: "한국어" }[word.language];
  group.append(languageLabel);

  if (query) {
    const searchable = [
      word.id,
      word.meaning,
      ...Object.values(word.definitions ?? {}),
      ...Object.values(word.translations),
      word.pinyin,
      word.reading
    ]
      .join(" ").toLocaleLowerCase();
    if (!searchable.includes(query)) group.classList.add("is-dimmed");
  }

  group.addEventListener("click", () => {
    if (Date.now() < ignoreClickUntil) return;
    onSelect(word.id, node.relation ?? null);
  });
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(word.id, node.relation ?? null);
    }
  });
  const showEnglishTranslation = () => {
    if (!word.language || word.language === "en" || !onHover || group.dataset.hovered === "true") return;
    group.dataset.hovered = "true";
    onHover(word).then((translation) => {
      if (group.isConnected && group.dataset.hovered === "true") {
        const englishTip = `${translate(language, "hover.english")}: ${translation}`;
        group.setAttribute("title", englishTip);
        group.setAttribute("aria-label", `${nodeAriaLabel}. ${englishTip}`);
      }
    }).catch((error) => console.warn("Unable to translate hovered word:", error));
  };
  const clearEnglishTranslation = () => {
    delete group.dataset.hovered;
    group.removeAttribute("title");
    group.setAttribute("aria-label", nodeAriaLabel);
    clearHighlights({ currentTarget: group });
  };
  group.addEventListener("pointerenter", () => {
    highlightConnections(group, word.id);
    showEnglishTranslation();
  });
  group.addEventListener("focus", showEnglishTranslation);
  group.addEventListener("pointerleave", clearEnglishTranslation);
  group.addEventListener("blur", clearEnglishTranslation);
  parent.append(group);
}

function highlightConnections(group, id) {
  const svg = group.ownerSVGElement;
  for (const edge of svg.querySelectorAll(".graph-edge")) {
    edge.classList.toggle("is-active", edge.dataset.source === id || edge.dataset.target === id);
  }
}

function clearHighlights(event) {
  const svg = event.currentTarget?.ownerSVGElement ??
    [...document.querySelectorAll("#graph svg")].at(-1);
  svg?.querySelectorAll(".graph-edge.is-active").forEach((edge) => edge.classList.remove("is-active"));
}

function applyViewport(svg) {
  const content = svg.querySelector(".graph-content");
  content.setAttribute(
    "transform",
    `translate(${viewport.x} ${viewport.y}) translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2}) scale(${viewport.scale}) translate(${-VIEW_WIDTH / 2} ${-VIEW_HEIGHT / 2})`
  );
}

function changeZoom(amount) {
  viewport.scale = Math.max(.72, Math.min(1.65, viewport.scale + amount));
  const svg = [...document.querySelectorAll("#graph svg")].at(-1);
  if (svg) applyViewport(svg);
}

export function zoomGraph(direction) {
  changeZoom(direction * .14);
}

export function resetGraphView() {
  viewport.scale = 1;
  viewport.x = 0;
  viewport.y = 0;
  const svg = [...document.querySelectorAll("#graph svg")].at(-1);
  if (svg) applyViewport(svg);
}

function enablePanAndZoom(svg) {
  let drag = null;
  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? .08 : -.08);
  }, { passive: false });
  svg.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".graph-node")) return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      panX: viewport.x,
      panY: viewport.y,
      moved: false
    };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const bounds = svg.getBoundingClientRect();
    const dx = (event.clientX - drag.x) * VIEW_WIDTH / bounds.width;
    const dy = (event.clientY - drag.y) * VIEW_HEIGHT / bounds.height;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    viewport.x = drag.panX + dx;
    viewport.y = drag.panY + dy;
    applyViewport(svg);
  });
  svg.addEventListener("pointerup", () => {
    if (drag?.moved) ignoreClickUntil = Date.now() + 180;
    drag = null;
  });
  svg.addEventListener("pointercancel", () => { drag = null; });
}

export function renderGraph(container, words, options) {
  const { language, selectedId, query, activeTypes, activeLanguages, onSelect, onHover,
    developmentGraph } = options;
  const center = words.find((word) => word.id === selectedId);
  if (!center) return { nodeCount: 0, edgeCount: 0 };

  const layout = getLayout(center, words, new Set(activeTypes), developmentGraph,
    activeLanguages);

  const svg = svgElement("svg", {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    role: "group",
    "aria-label": translate(language, "aria.wordMap", {
      word: center.word,
      language: languageName(center.language, language)
    })
  });
  const content = svgElement("g", { class: "graph-content" });
  const edgeLayer = svgElement("g", { "aria-hidden": "true" });
  const nodeLayer = svgElement("g", { class: "graph-nodes" });
  const relationshipTypes = options.relationshipTypes;

  layout.edges.forEach((edge, index) => {
    drawEdge(edgeLayer, nodePointFor(edge, "from"), nodePointFor(edge, "to"), edge.connection,
      relationshipTypes, language, 140 + index * 48);
  });
  layout.nodes.forEach((node, index) => {
    addNode(nodeLayer, node, index, language, selectedId, query, onSelect, onHover);
  });

  content.append(edgeLayer, nodeLayer);
  svg.append(content);
  const previous = container.querySelector("svg");
  svg.classList.add("is-entering");
  container.append(svg);
  if (previous) {
    previous.classList.add("is-leaving");
    previous.setAttribute("aria-hidden", "true");
    window.setTimeout(() => previous.remove(), 240);
  }
  window.setTimeout(() => svg.classList.remove("is-entering"), 360);
  applyViewport(svg);
  enablePanAndZoom(svg);
  return { nodeCount: layout.nodes.length, edgeCount: layout.edges.length };
}
