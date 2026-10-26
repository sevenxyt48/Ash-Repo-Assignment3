# Word Paths

Word Paths is a static web app for exploring words, definitions, and meaningful connections between Chinese, English, Japanese, and Korean through an interactive relationship graph.

## Preview

> Add prototype images or project screenshots to `word-paths/assets/images/`, then replace the placeholder text below with Markdown images. For example: `![Main interface](word-paths/assets/images/main-interface.png)`.

### Main Interface

_Image placeholder: screenshot of the main interface_

<!-- ![Main interface](word-paths/assets/images/main-interface.png) -->

### Word Relationship Graph

_Image placeholder: relationship graph or interaction screenshot_

<!-- ![Word relationship graph](word-paths/assets/images/word-graph.png) -->

### Word Details

_Image placeholder: screenshot of the word details panel_

<!-- ![Word details](word-paths/assets/images/word-details.png) -->

## Features

- Search words, pronunciations, and Chinese definitions across four languages.
- Change the graph's display language and filter words by topic.
- Select a graph node to view its details, translations in all four languages, and related words.
- Discover words with the Random Explore button.
- Supports keyboard navigation, narrow screens, and reduced-motion preferences.

## Run Locally

The app needs a local static server to load its JSON data. Open a terminal and run:

```bash
cd word-paths
python -m http.server 8000
```

Then visit <http://localhost:8000> in a browser. You can also use VS Code Live Server or another static server to serve the `word-paths/` directory. Do not open `index.html` directly: browsers generally block local JSON requests from `file://` pages.

## Project Structure

```text
word-paths/
├── index.html
├── css/
│   ├── styles.css
│   └── animations.css
├── js/
│   ├── app.js
│   ├── graph.js
│   └── details.js
├── data/
│   └── words.json
└── README.md
```

## Technical Notes

- Built with native HTML, CSS, and JavaScript; no frontend dependencies or build step required.
- SVG is used to draw word nodes and relationship lines.
- Word entries, translations, pronunciations, definitions, and relationships are stored in `word-paths/data/words.json`.

## Data

The current JSON file contains a small set of sample vocabulary for demonstrating the app. Each entry includes a unique ID, topic, translations in four languages, pronunciations, a Chinese definition, and its relationships. When adding an entry, make sure each relationship target ID refers to an existing word.

---

# Word Paths — 词语之间

Word Paths 是一个静态网页词语探索工具。通过交互式关系图，探索中文、英语、日语和韩语中的词语、释义与意义联系。

## 项目预览

> 将之后的原型图或项目截图放入 `word-paths/assets/images/`，再把下方占位说明替换为 Markdown 图片，例如：`![主界面](word-paths/assets/images/main-interface.png)`。

### 主界面

_图片占位：主界面截图_

<!-- ![主界面](word-paths/assets/images/main-interface.png) -->

### 词语关系图

_图片占位：关系图或交互状态截图_

<!-- ![词语关系图](word-paths/assets/images/word-graph.png) -->

### 词语详情

_图片占位：词语详情面板截图_

<!-- ![词语详情](word-paths/assets/images/word-details.png) -->

## 功能

- 搜索四种语言的词语、读音和中文释义。
- 切换图谱显示语言，并按主题筛选词语。
- 选择图谱节点查看词语详情、四语对照和关联词。
- 使用“随机漫游”发现词语。
- 支持键盘操作、窄屏布局和减少动态效果偏好。

## 运行

网页需要通过本地静态服务器读取 JSON 数据。打开终端并运行：

```bash
cd word-paths
python -m http.server 8000
```

然后在浏览器访问 <http://localhost:8000>。也可以使用 VS Code Live Server 等静态服务器打开 `word-paths/` 目录。请勿直接双击 `index.html`，因为浏览器通常会阻止 `file://` 页面读取本地 JSON。

## 项目结构

```text
word-paths/
├── index.html
├── css/
│   ├── styles.css
│   └── animations.css
├── js/
│   ├── app.js
│   ├── graph.js
│   └── details.js
├── data/
│   └── words.json
└── README.md
```

## 技术说明

- 使用原生 HTML、CSS 和 JavaScript，无需安装前端依赖或运行构建步骤。
- 使用 SVG 绘制词语节点和关系连线。
- 词条、翻译、读音、释义和关系保存在 `word-paths/data/words.json`。

## 数据说明

当前 JSON 文件包含用于演示的词汇样例。每个词条包含唯一 ID、主题、四种语言的词语、读音、中文释义和关联关系。添加词条时，关系中的目标 ID 必须对应已有词条。
