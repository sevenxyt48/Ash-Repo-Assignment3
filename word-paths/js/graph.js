// 此文件计算词汇关系图布局并绘制可交互的 SVG 节点与连线。
const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 560;
const TYPE_ORDER = ["origin", "similar", "confusable", "antonym"];
const viewport = { scale: 1, x: 0, y: 0 };
let ignoreClickUntil = 0;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function getConnections(word, words, activeTypes) {
  const byId = new Map(words.map((item) => [item.id, item]));
  const connections = new Map();
  for (const item of words) {
    for (const connection of item.connections) {
      if (!activeTypes.has(connection.type)) continue;
      if (item.id === word.id) {
        connections.set(connection.target, { ...connection, source: word.id });
      } else if (connection.target === word.id) {
        connections.set(item.id, {
          ...connection,
          target: item.id,
          source: word.id
        });
      }
    }
  }
  return [...connections.values()]
    .map((connection) => ({ ...connection, word: byId.get(connection.target) }))
    .filter((connection) => connection.word)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
}

function getLayout(center, words, activeTypes) {
  const visible = [{ word: center, x: 500, y: 280, depth: 0 }];
  const edges = [];
  const seen = new Set([center.id]);
  const firstLevel = getConnections(center, words, activeTypes).slice(0, 6);

  firstLevel.forEach((connection, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const row = Math.floor(index / 2);
    const rowsOnSide = Math.ceil(firstLevel.length / 2);
    const y = 280 + (row - (rowsOnSide - 1) / 2) * 128;
    const node = { word: connection.word, x: side < 0 ? 200 : 800, y, depth: 1, relation: connection };
    visible.push(node);
    seen.add(node.word.id);
    edges.push({ from: visible[0], to: node, connection });
  });

  const secondary = [];
  for (const parent of visible.slice(1)) {
    const next = getConnections(parent.word, words, activeTypes)
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

function drawEdge(parent, from, to, connection, relationshipTypes) {
  const direction = to.x >= from.x ? 1 : -1;
  const gap = Math.abs(to.x - from.x);
  const bend = Math.min(105, gap * .42);
  const path = svgElement("path", {
    d: `M ${from.x} ${from.y} C ${from.x + direction * bend} ${from.y}, ${to.x - direction * bend} ${to.y}, ${to.x} ${to.y}`,
    class: `graph-edge edge-${connection.type}`,
    "data-source": connection.source,
    "data-target": connection.target,
    "aria-label": relationshipTypes[connection.type] ?? connection.type
  });
  parent.append(path);

  const middleX = (from.x + to.x) / 2;
  const middleY = (from.y + to.y) / 2 + (to.y >= from.y ? 16 : -12);
  const label = svgElement("text", { x: middleX, y: middleY, class: "edge-label" });
  label.textContent = relationshipTypes[connection.type] ?? connection.type;
  parent.append(label);
}

function addNode(parent, node, language, otherLanguages, selectedId, query, onSelect) {
  const { word, x, y, depth } = node;
  const label = word.translations[language] ?? word.translations.en;
  const meaning = word.definitions?.[language] ?? word.definitions?.en ?? word.meaning;
  const group = svgElement("g", {
    class: `graph-node${word.id === selectedId ? " is-center" : ""}${depth === 1 ? " is-connected" : ""}`,
    transform: `translate(${x} ${y})`,
    tabindex: "0",
    role: "button",
    "aria-pressed": String(word.id === selectedId),
    "data-id": word.id
  });
  const chineseReading = language !== "zh" && word.translations.zh
    ? `, Chinese ${word.translations.zh}, pinyin ${word.pinyin}`
    : "";
  group.setAttribute("aria-label", `${label}${chineseReading} — ${meaning}`);

  group.append(
    svgElement("circle", { r: "37", class: "node-halo" }),
    svgElement("circle", { r: "31", class: "node-core" })
  );
  const text = svgElement("text", { y: "-3", class: "node-label" });
  text.textContent = label;
  group.append(text);

  if (language !== "zh" && word.pinyin) {
    const pinyin = svgElement("text", { y: "13", class: "node-pinyin" });
    pinyin.textContent = word.pinyin;
    group.append(pinyin);
  }

  if (otherLanguages) {
    const alternatives = Object.entries(word.translations)
      .filter(([code]) => code !== language)
      .map(([code, translation]) => code === "zh" ? `${translation} (${word.pinyin})` : translation)
      .join(" · ");
    const other = svgElement("text", { y: "25", class: "node-pinyin node-alternates" });
    other.textContent = alternatives;
    group.append(other);
  }

  if (query) {
    const searchable = [
      word.id,
      word.meaning,
      ...Object.values(word.definitions ?? {}),
      ...Object.values(word.translations),
      word.pinyin
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
      onSelect(word.id, null);
    }
  });
  group.addEventListener("pointerenter", () => highlightConnections(group, word.id));
  group.addEventListener("pointerleave", clearHighlights);
  parent.append(group);
}

function highlightConnections(group, id) {
  const svg = group.ownerSVGElement;
  for (const edge of svg.querySelectorAll(".graph-edge")) {
    edge.classList.toggle("is-active", edge.dataset.source === id || edge.dataset.target === id);
  }
}

function clearHighlights(event) {
  const svg = event.currentTarget?.ownerSVGElement ?? document.querySelector("#graph svg");
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
  const svg = document.querySelector("#graph svg");
  if (svg) applyViewport(svg);
}

export function zoomGraph(direction) {
  changeZoom(direction * .14);
}

export function resetGraphView() {
  viewport.scale = 1;
  viewport.x = 0;
  viewport.y = 0;
  const svg = document.querySelector("#graph svg");
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
  const { language, selectedId, query, activeTypes, otherLanguages, onSelect } = options;
  const center = words.find((word) => word.id === selectedId);
  if (!center) return { nodeCount: 0, edgeCount: 0 };

  const layout = getLayout(center, words, new Set(activeTypes));

  const svg = svgElement("svg", {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    role: "group",
    "aria-label": `Word relationships centered on ${center.translations[language] ?? center.translations.en}`
  });
  const content = svgElement("g", { class: "graph-content" });
  const edgeLayer = svgElement("g", { "aria-hidden": "true" });
  const nodeLayer = svgElement("g", { class: "graph-nodes" });
  const relationshipTypes = options.relationshipTypes;

  for (const edge of layout.edges) {
    drawEdge(edgeLayer, nodePointFor(edge, "from"), nodePointFor(edge, "to"), edge.connection, relationshipTypes);
  }
  for (const node of layout.nodes) {
    addNode(nodeLayer, node, language, otherLanguages, selectedId, query, onSelect);
  }

  content.append(edgeLayer, nodeLayer);
  svg.append(content);
  container.replaceChildren(svg);
  applyViewport(svg);
  enablePanAndZoom(svg);
  return { nodeCount: layout.nodes.length, edgeCount: layout.edges.length };
}
