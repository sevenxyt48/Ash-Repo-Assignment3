import { renderGraph } from "./graph.js";
import { renderDetails, renderEmptyDetails } from "./details.js";

const graphContainer = document.querySelector("#graph");
const graphMessage = document.querySelector("#graph-message");
const searchInput = document.querySelector("#search");
const languageSelect = document.querySelector("#language");
const categorySelect = document.querySelector("#category");
const randomButton = document.querySelector("#random");
const detailsPanel = document.querySelector("#details");
const resultCount = document.querySelector("#result-count");

const state = {
  data: null,
  category: "all",
  language: "zh",
  query: "",
  selectedId: null
};

function selectWord(id) {
  state.selectedId = id;
  render();
  const selectedNode = graphContainer.querySelector(`[data-id="${CSS.escape(id)}"]`);
  selectedNode?.focus({ preventScroll: true });
}

function render() {
  const visibleWords = renderGraph(graphContainer, state.data.words, {
    language: state.language,
    category: state.category,
    selectedId: state.selectedId,
    query: state.query,
    relationshipTypes: state.data.relationshipTypes,
    onSelect: selectWord
  });
  const matches = state.query
    ? visibleWords.filter((word) => {
        const text = [
          ...Object.values(word.translations),
          word.pinyin,
          ...Object.values(word.romanization),
          word.meaning
        ].join(" ").toLocaleLowerCase();
        return text.includes(state.query);
      })
    : visibleWords;
  resultCount.textContent = state.query
    ? `${matches.length} 个匹配词语 · 共 ${visibleWords.length} 个节点`
    : `${visibleWords.length} 个词语 · ${state.data.categories[state.category] ?? "全部主题"}`;

  const selected = state.data.words.find((word) => word.id === state.selectedId);
  if (selected) {
    renderDetails(detailsPanel, selected, state.data, state.language, selectWord);
  } else {
    renderEmptyDetails(detailsPanel);
  }
}

function showError(message) {
  graphMessage.hidden = false;
  graphMessage.textContent = message;
  resultCount.textContent = "词语数据载入失败";
}

async function initialize() {
  try {
    const response = await fetch("./data/words.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!Array.isArray(state.data.words) || state.data.words.length === 0) {
      throw new Error("词语数据为空或格式无效");
    }
    for (const [id, name] of Object.entries(state.data.categories)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      categorySelect.append(option);
    }
    graphMessage.hidden = true;
    render();
  } catch (error) {
    console.error("Unable to load the word graph:", error);
    showError("无法载入词语数据。请通过本地服务器打开此页面，然后刷新重试。");
  }
}

searchInput.addEventListener("input", () => {
  state.query = searchInput.value.trim().toLocaleLowerCase();
  if (state.data) render();
});

languageSelect.addEventListener("change", () => {
  state.language = languageSelect.value;
  if (state.data) render();
});

categorySelect.addEventListener("change", () => {
  state.category = categorySelect.value;
  if (state.data) {
    const selected = state.data.words.find((word) => word.id === state.selectedId);
    if (selected && state.category !== "all" && selected.category !== state.category) {
      state.selectedId = null;
    }
    render();
  }
});

randomButton.addEventListener("click", () => {
  if (!state.data) return;
  const choices = state.data.words.filter((word) =>
    state.category === "all" || word.category === state.category
  );
  if (choices.length === 0) return;
  const available = choices.filter((word) => word.id !== state.selectedId);
  const pool = available.length ? available : choices;
  const next = pool[Math.floor(Math.random() * pool.length)];
  selectWord(next.id);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && document.activeElement === searchInput) {
    searchInput.value = "";
    state.query = "";
    if (state.data) render();
  }
});

initialize();
