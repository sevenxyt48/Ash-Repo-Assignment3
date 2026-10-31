// 此文件计算词汇关系图布局并绘制可交互的 SVG 节点与连线。
import { formatVocabularyWord, languageName, translate } from "./i18n.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 560;
const TYPE_ORDER = ["equivalent", "origin", "similar", "confusable", "antonym"];
const viewport = { scale: 1, x: 0, y: 0 };
const positionOverrides = new Map();
const svgEdgeMaps = new WeakMap();
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

// 从中心词出发收集可见子图；只有被用户展开过的词才会继续向外延伸。
function collectGraph(center, words, activeTypes, developmentGraph, activeLanguages, expandedIds) {
  const byId = new Map(words.map((word) => [word.id, word]));
  const edges = [];
  const edgeKeys = new Set();
  const visible = new Set([center.id]);
  const traversed = new Set([center.id]);
  const queue = [center.id];
  while (queue.length) {
    const id = queue.shift();
    const word = byId.get(id);
    if (!word) continue;
    for (const connection of getConnections(word, words, activeTypes, developmentGraph,
      activeLanguages)) {
      const otherId = connection.targetWordId;
      if (!byId.has(otherId)) continue;
      visible.add(otherId);
      const key = `${[id, otherId].sort().join("\u0000")}\u0000${
        connection.productRelationType ?? connection.rawRelationType}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({ id: key, fromId: id, toId: otherId, connection });
      }
      if (expandedIds?.has(otherId) && !traversed.has(otherId)) {
        traversed.add(otherId);
        queue.push(otherId);
      }
    }
  }
  return { byId, visible: [...visible], edges };
}

function getLayout(center, words, activeTypes, developmentGraph, activeLanguages, expandedIds) {
  const { byId, visible, edges } = collectGraph(center, words, activeTypes, developmentGraph,
    activeLanguages, expandedIds);
  const adjacency = new Map(visible.map((id) => [id, []]));
  for (const edge of edges) {
    adjacency.get(edge.fromId)?.push(edge.toId);
    adjacency.get(edge.toId)?.push(edge.fromId);
  }
  const depth = new Map([[center.id, 0]]);
  const children = new Map(visible.map((id) => [id, []]));
  const queue = [center.id];
  while (queue.length) {
    const id = queue.shift();
    for (const other of adjacency.get(id) ?? []) {
      if (depth.has(other)) continue;
      depth.set(other, depth.get(id) + 1);
      children.get(id)?.push(other);
      queue.push(other);
    }
  }

  const leafCounts = new Map();
  const countLeaves = (id) => {
    if (leafCounts.has(id)) return leafCounts.get(id);
    const kids = children.get(id) ?? [];
    const value = kids.length ? kids.reduce((sum, kid) => sum + countLeaves(kid), 0) : 1;
    leafCounts.set(id, value);
    return value;
  };
  countLeaves(center.id);

  const nodes = [];
  const nodeMap = new Map();
  const place = (id, startAngle, endAngle) => {
    const level = depth.get(id) ?? 0;
    const angle = (startAngle + endAngle) / 2;
    const radius = level === 0 ? 0 : level === 1 ? 155 : level === 2 ? 235 : 275;
    const x = 500 + radius * 1.55 * Math.cos(angle);
    const y = 280 + radius * Math.sin(angle);
    const node = { word: byId.get(id), x, y, depth: level };
    nodes.push(node);
    nodeMap.set(id, node);
    const kids = children.get(id) ?? [];
    const total = kids.reduce((sum, kid) => sum + countLeaves(kid), 0) || 1;
    let cursor = startAngle;
    for (const kid of kids) {
      const span = (endAngle - startAngle) * countLeaves(kid) / total;
      place(kid, cursor, cursor + span);
      cursor += span;
    }
  };
  place(center.id, Math.PI / 2, Math.PI / 2 + Math.PI * 2);

  const layoutEdges = edges.map((edge) => ({
    id: edge.id,
    from: nodeMap.get(edge.fromId),
    to: nodeMap.get(edge.toId),
    connection: {
      ...edge.connection,
      sourceId: edge.fromId,
      targetWordId: edge.toId
    }
  })).filter((edge) => edge.from && edge.to);

  return { nodes, edges: layoutEdges };
}

function edgeGeometry(from, to) {
  const direction = to.x >= from.x ? 1 : -1;
  const bend = Math.min(105, Math.abs(to.x - from.x) * .42);
  return `M ${from.x} ${from.y} C ${from.x + direction * bend} ${from.y}, ${
    to.x - direction * bend} ${to.y}, ${to.x} ${to.y}`;
}

function relationshipLabel(connection, relationshipTypes, language) {
  const type = connection.productRelationType;
  const relationshipText = type
    ? translate(language, `relationship.${type}`)
    : translate(language, "relationship.rawType", { type: connection.rawRelationType });
  const baseLabel = relationshipText.startsWith("relationship.")
    ? relationshipTypes[type] ?? type ?? connection.rawRelationType
    : relationshipText;
  const statusLabel = connection.verificationStatus === "demo"
    ? translate(language, "relationship.demoMarker")
    : "";
  return [baseLabel, statusLabel].filter(Boolean).join(" · ");
}

function createEdge(edge, relationshipTypes, language, delay) {
  const type = edge.connection.productRelationType;
  return svgElement("path", {
    d: edgeGeometry(edge.from, edge.to),
    class: `graph-edge edge-${(type ?? "unclassified").replace(/[^a-z0-9_-]/gi, "-")}`,
    "data-source": edge.from.word.id,
    "data-target": edge.to.word.id,
    "data-edge-key": edge.id,
    "aria-label": relationshipLabel(edge.connection, relationshipTypes, language),
    style: `--edge-delay: ${delay}ms`
  });
}

function pointerToGraph(svg, event) {
  const bounds = svg.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * VIEW_WIDTH / bounds.width;
  const y = (event.clientY - bounds.top) * VIEW_HEIGHT / bounds.height;
  const centerX = VIEW_WIDTH / 2;
  const centerY = VIEW_HEIGHT / 2;
  return {
    x: (x - viewport.x - centerX) / viewport.scale + centerX,
    y: (y - viewport.y - centerY) / viewport.scale + centerY
  };
}

function indexEdges(svg) {
  const layer = svg.querySelector(".graph-edges");
  const map = new Map();
  for (const element of layer?.children ?? []) {
    map.set(element.dataset.edgeKey, element);
  }
  svgEdgeMaps.set(svg, map);
}

function redrawConnectedEdges(svg, wordId) {
  const layout = svg.__layout;
  const edgeMap = svgEdgeMaps.get(svg);
  if (!layout || !edgeMap) return;
  for (const edge of layout.edges) {
    if (edge.from.word.id !== wordId && edge.to.word.id !== wordId) continue;
    edgeMap.get(edge.id)?.setAttribute("d", edgeGeometry(edge.from, edge.to));
  }
}

function attachNodeDrag(group) {
  let drag = null;
  const onMove = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const node = group.__node;
    if (!node) return;
    const point = pointerToGraph(group.ownerSVGElement, event);
    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      group.classList.add("is-dragging");
    }
    node.x = drag.nodeX + dx;
    node.y = drag.nodeY + dy;
    group.style.transform = `translate(${node.x}px, ${node.y}px)`;
    redrawConnectedEdges(group.ownerSVGElement, node.word.id);
  };
  const onEnd = (event) => {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const node = group.__node;
    if (drag.moved && node) {
      ignoreClickUntil = Date.now() + 220;
      const centerId = group.ownerSVGElement.dataset.centerId;
      positionOverrides.set(`${centerId}\u0000${node.word.id}`, { x: node.x, y: node.y });
    }
    group.classList.remove("is-dragging");
    try {
      if (group.hasPointerCapture?.(drag.pointerId)) {
        group.releasePointerCapture(drag.pointerId);
      }
    } catch (error) {
      console.warn("Unable to release pointer capture:", error);
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    drag = null;
  };
  group.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag) return;
    const node = group.__node;
    if (!node) return;
    const origin = pointerToGraph(group.ownerSVGElement, event);
    drag = {
      pointerId: event.pointerId,
      startX: origin.x,
      startY: origin.y,
      nodeX: node.x,
      nodeY: node.y,
      moved: false
    };
    try {
      group.setPointerCapture(event.pointerId);
    } catch (error) {
      // 触控与合成事件可能无法捕获指针，改用窗口监听继续拖动。
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  });
}

function createNode(node, index, context) {
  const { language, selectedId, query, onSelect, onHover } = context;
  const { word, depth } = node;
  const label = word.word;
  const delay = word.id === selectedId ? 0 : 90 + index * 55;
  const group = svgElement("g", {
    class: `graph-node${word.id === selectedId ? " is-center" : ""}${
      depth === 1 && word.id !== selectedId ? " is-connected" : ""}`,
    tabindex: "0",
    role: "button",
    "aria-pressed": String(word.id === selectedId),
    "data-id": word.id,
    style: `--node-delay: ${delay}ms; --float-delay: ${(index % 4) * .55}s`
  });
  group.style.transform = `translate(${node.x}px, ${node.y}px)`;
  group.__node = node;
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
    onSelect(word.id);
  });
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(word.id);
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
  attachNodeDrag(group);
  return group;
}

function updateNode(group, node, selectedId) {
  group.style.transform = `translate(${node.x}px, ${node.y}px)`;
  group.__node = node;
  group.classList.toggle("is-center", node.word.id === selectedId);
  group.classList.toggle("is-connected",
    node.depth === 1 && node.word.id !== selectedId);
  group.setAttribute("aria-pressed", String(node.word.id === selectedId));
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

function createSvg(layout, context) {
  const svg = svgElement("svg", {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    role: "group",
    "aria-label": translate(context.language, "aria.wordMap", {
      word: context.center.word,
      language: languageName(context.center.language, context.language)
    }),
    "data-center-id": context.selectedId,
    "data-ui-language": context.language
  });
  const content = svgElement("g", { class: "graph-content" });
  const edgeLayer = svgElement("g", { class: "graph-edges", "aria-hidden": "true" });
  const nodeLayer = svgElement("g", { class: "graph-nodes" });
  layout.edges.forEach((edge, index) => {
    edgeLayer.append(createEdge(edge, context.relationshipTypes, context.language,
      140 + index * 48));
  });
  layout.nodes.forEach((node, index) => {
    nodeLayer.append(createNode(node, index, context));
  });
  content.append(edgeLayer, nodeLayer);
  svg.append(content);
  return svg;
}

// 在已有 SVG 上就地增删节点与连线，避免整图刷新。
function updateSvg(svg, layout, context) {
  const edgeLayer = svg.querySelector(".graph-edges");
  const nodeLayer = svg.querySelector(".graph-nodes");
  const existingEdges = new Map(
    [...edgeLayer.children].map((element) => [element.dataset.edgeKey, element]));
  const keptEdges = new Set();
  layout.edges.forEach((edge, index) => {
    keptEdges.add(edge.id);
    const path = existingEdges.get(edge.id);
    if (path) {
      path.setAttribute("d", edgeGeometry(edge.from, edge.to));
    } else {
      edgeLayer.append(createEdge(edge, context.relationshipTypes, context.language,
        120 + index * 30));
    }
  });
  for (const [key, element] of existingEdges) {
    if (!keptEdges.has(key)) element.remove();
  }

  const existingNodes = new Map(
    [...nodeLayer.children].map((element) => [element.dataset.id, element]));
  const keptNodes = new Set();
  layout.nodes.forEach((node, index) => {
    keptNodes.add(node.word.id);
    const group = existingNodes.get(node.word.id);
    if (group) {
      updateNode(group, node, context.selectedId);
    } else {
      nodeLayer.append(createNode(node, index, context));
    }
  });
  for (const [id, element] of existingNodes) {
    if (!keptNodes.has(id)) element.remove();
  }

  svg.setAttribute("aria-label", translate(context.language, "aria.wordMap", {
    word: context.center.word,
    language: languageName(context.center.language, context.language)
  }));
}

export function renderGraph(container, words, options) {
  const { language, selectedId, query, activeTypes, activeLanguages, onSelect, onHover,
    developmentGraph, relationshipTypes, expandedIds } = options;
  const center = words.find((word) => word.id === selectedId);
  if (!center) return { nodeCount: 0, edgeCount: 0 };

  const layout = getLayout(center, words, new Set(activeTypes), developmentGraph,
    activeLanguages, expandedIds);
  for (const node of layout.nodes) {
    const override = positionOverrides.get(`${selectedId}\u0000${node.word.id}`);
    if (override) {
      node.x = override.x;
      node.y = override.y;
    }
  }
  const context = { center, selectedId, language, query, onSelect, onHover,
    relationshipTypes, layout };

  const current = [...container.querySelectorAll("svg")].at(-1);
  const canUpdate = current &&
    current.dataset.centerId === String(selectedId) &&
    current.dataset.uiLanguage === language;
  if (canUpdate) {
    current.__layout = layout;
    updateSvg(current, layout, context);
    indexEdges(current);
    applyViewport(current);
  } else {
    if (current && current.dataset.centerId !== String(selectedId)) {
      viewport.scale = 1;
      viewport.x = 0;
      viewport.y = 0;
    }
    const svg = createSvg(layout, context);
    svg.__layout = layout;
    indexEdges(svg);
    svg.classList.add("is-entering");
    for (const stale of container.querySelectorAll("svg")) {
      if (stale !== current) stale.remove();
    }
    container.append(svg);
    if (current) {
      current.classList.add("is-leaving");
      current.setAttribute("aria-hidden", "true");
      window.setTimeout(() => current.remove(), 240);
    }
    window.setTimeout(() => svg.classList.remove("is-entering"), 360);
    applyViewport(svg);
    enablePanAndZoom(svg);
  }
  return { nodeCount: layout.nodes.length, edgeCount: layout.edges.length };
}
