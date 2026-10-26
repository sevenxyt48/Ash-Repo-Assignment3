# Word Paths — 词语之间

一个无需构建工具或第三方 JavaScript 依赖的静态网页，用交互式关系图探索中文、英语、日语和韩语词语之间的联系。

## 运行

网页通过 `fetch` 读取 `data/words.json`，不要直接双击 `index.html`（浏览器通常会阻止 `file://` 页面读取本地 JSON）。在项目根目录启动一个本地静态服务器：

```bash
python -m http.server 8000
```

然后访问 <http://localhost:8000>。也可以用 VS Code 的 Live Server 等静态服务器打开本目录。

## 功能

- 搜索四种语言的词语、中文拼音、日语/韩语读音和释义；按 `/` 聚焦搜索框，按 `Escape` 清空。
- 切换图谱节点的显示语言，或按自然、时间、情感、旅程筛选词语。
- 选择节点查看释义、四语对照和可继续探索的关联词；按“随机漫游”发现新词。
- 使用键盘 Tab 聚焦节点，再按 Enter 或空格打开详情。
- 支持窄屏布局和减少动态效果的系统偏好。

## 目录

```text
word-paths/
├── index.html          # 页面入口和主要结构
├── css/
│   ├── styles.css      # 布局、配色、节点与响应式样式
│   └── animations.css  # 过渡和悬停反馈
├── js/
│   ├── app.js          # 数据加载、搜索、筛选和随机选词
│   ├── graph.js        # 关系图布局、节点和连线交互
│   └── details.js      # 词语详情与相连词语
└── data/
    └── words.json      # 四语词汇、读音、释义、主题和关系
```

## 数据格式

`words.json` 包含主题名称、关系类型名称和 `words` 数组。每个词条有唯一 `id`、`category`、四种语言的 `translations`、中文 `pinyin`、日语与韩语 `romanization`、中文 `meaning`，以及指向其他词条的 `connections`。关系类型为 `related`（语义相关）、`imagery`（意象联想）和 `contrast`（对照关系）。添加词条时，请确保关系的 `target` 指向已有词条 ID。

当前词条和释义是用于演示交互的精简样例，可继续按此格式扩展或替换。
