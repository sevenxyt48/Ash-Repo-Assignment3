# Word Paths — 第一版关系候选抽样检查

本清单从 `word-paths/data/candidate-relationships.json` 选取 21 条候选，供人工逐条核对。所有记录仍为 `candidate`；词典条目链接只用于核对词形、释义和读音，不等于词典已经明确声明两词存在所列关系。

| 中文 | 日语（读音） | 韩语 | 类型 | 关系端点 | 来源链接 | 为什么需要检查 |
|---|---|---|---|---|---|---|
| 水 | 水（みず） | 물 | equivalent | 水 ↔ 水（日） | [中文](https://zh.wiktionary.org/wiki/%E6%B0%B4) · [日语](https://ja.wiktionary.org/wiki/%E6%B0%B4) | 核对液态水这一核心义及日常用法是否对齐。 |
| 水 | 水（みず） | 물 | equivalent | 水 ↔ 물 | [中文](https://zh.wiktionary.org/wiki/%E6%B0%B4) · [韩语](https://ko.wiktionary.org/wiki/%EB%AC%BC) | 核对是否均指水，而不是饮料、液体等延伸义。 |
| 水 | 水（みず） | 물 | equivalent | 水（日） ↔ 물 | [日语](https://ja.wiktionary.org/wiki/%E6%B0%B4) · [韩语](https://ko.wiktionary.org/wiki/%EB%AC%BC) | 确认两端是同一核心词义，而不只是译文相同。 |
| 河 | 川（かわ） | 강 | equivalent | 河 ↔ 川 | [中文](https://zh.wiktionary.org/wiki/%E6%B2%B3) · [日语](https://ja.wiktionary.org/wiki/%E5%B7%9D) | 核对中文「河」与日语「川」的范围和常用语境。 |
| 河 | 川（かわ） | 강 | equivalent | 河 ↔ 강 | [中文](https://zh.wiktionary.org/wiki/%E6%B2%B3) · [韩语](https://ko.wiktionary.org/wiki/%EA%B0%95) | 核对自然河流义及是否存在范围差异。 |
| 河 | 川（かわ） | 강 | equivalent | 川 ↔ 강 | [日语](https://ja.wiktionary.org/wiki/%E5%B7%9D) · [韩语](https://ko.wiktionary.org/wiki/%EA%B0%95) | 避免仅因英译 “river” 相同就认定全部用法等价。 |
| 希望 | 希望（きぼう） | 희망 | equivalent | 希望 ↔ 希望（日） | [中文](https://zh.wiktionary.org/wiki/%E5%B8%8C%E6%9C%9B) · [日语](https://ja.wiktionary.org/wiki/%E5%B8%8C%E6%9C%9B) | 核对“希望”与愿望、期待等具体义项的重叠范围。 |
| 希望 | 希望（きぼう） | 희망 | equivalent | 希望 ↔ 희망 | [中文](https://zh.wiktionary.org/wiki/%E5%B8%8C%E6%9C%9B) · [韩语](https://ko.wiktionary.org/wiki/%ED%9D%AC%EB%A7%9D) | 对照词条定义与语境，确认希望/期待等义项是否对应。 |
| 希望 | 希望（きぼう） | 희망 | equivalent | 希望（日） ↔ 희망 | [日语](https://ja.wiktionary.org/wiki/%E5%B8%8C%E6%9C%9B) · [韩语](https://ko.wiktionary.org/wiki/%ED%9D%AC%EB%A7%9D) | 核对两端义项及语体；不能因汉字来源相同就假设用法完全一致。 |
| 风 | 風（かぜ） | 바람 | equivalent | 风 ↔ 風 | [中文](https://zh.wiktionary.org/wiki/%E9%A3%8E) · [日语](https://ja.wiktionary.org/wiki/%E9%A2%A8) | 核对是否均指自然风，并核对词形对应。 |
| 风 | 風（かぜ） | 바람 | equivalent | 风 ↔ 바람 | [中文](https://zh.wiktionary.org/wiki/%E9%A3%8E) · [韩语](https://ko.wiktionary.org/wiki/%EB%B0%94%EB%9E%8C) | 韩语「바람」也可表示愿望；需确认词义区分，不能只看词条拼写。 |
| 风 | 風（かぜ） | 바람 | equivalent | 風 ↔ 바람 | [日语](https://ja.wiktionary.org/wiki/%E9%A2%A8) · [韩语](https://ko.wiktionary.org/wiki/%EB%B0%94%EB%9E%8C) | 特别检查韩语同形多义是否与日语自然风义相符。 |
| 学校 | 学校（がっこう） | 학교 | equivalent | 学校（中） ↔ 学校（日） | [中文](https://zh.wiktionary.org/wiki/%E5%AD%A6%E6%A0%A1) · [日语](https://ja.wiktionary.org/wiki/%E5%AD%A6%E6%A0%A1) | 确认相同汉字词在两种语言中的含义和使用范围。 |
| 学校 | 学校（がっこう） | 학교 | equivalent | 学校（中） ↔ 학교 | [中文](https://zh.wiktionary.org/wiki/%E5%AD%A6%E6%A0%A1) · [韩语](https://ko.wiktionary.org/wiki/%ED%95%99%EA%B5%90) | 核对具体教育机构义；注意候选词条页面的释义范围。 |
| 学校 | 学校（がっこう） | 학교 | equivalent | 学校（日） ↔ 학교 | [日语](https://ja.wiktionary.org/wiki/%E5%AD%A6%E6%A0%A1) · [韩语](https://ko.wiktionary.org/wiki/%ED%95%99%EA%B5%90) | 核对机构义是否对应，避免把行政定义差异忽略。 |
| 今天 | 今日（きょう） | 오늘 | equivalent | 今天 ↔ 今日 | [中文](https://zh.wiktionary.org/wiki/%E4%BB%8A%E5%A4%A9) · [日语](https://ja.wiktionary.org/wiki/%E4%BB%8A%E6%97%A5) | 日语读音并非按汉字直读；确认该读音对应今天这一义项。 |
| 今天 | 今日（きょう） | 오늘 | equivalent | 今天 ↔ 오늘 | [中文](https://zh.wiktionary.org/wiki/%E4%BB%8A%E5%A4%A9) · [韩语](https://ko.wiktionary.org/wiki/%EC%98%A4%EB%8A%98) | 核对时间指示义及口语使用范围。 |
| 今天 | 今日（きょう） | 오늘 | equivalent | 今日 ↔ 오늘 | [日语](https://ja.wiktionary.org/wiki/%E4%BB%8A%E6%97%A5) · [韩语](https://ko.wiktionary.org/wiki/%EC%98%A4%EB%8A%98) | 核对日语特定读法和韩语词条的语用是否相符。 |
| 白天 | 昼（ひる） | 낮 | antonym | 白天 ↔ 夜（中文） | [白天](https://zh.wiktionary.org/wiki/%E7%99%BD%E5%A4%A9) · [夜](https://zh.wiktionary.org/wiki/%E5%A4%9C) | 对立关系看似直观，但仍需核对“白天/夜”的义项和时间边界。 |
| 白天 | 昼（ひる） | 낮 | antonym | 昼 ↔ 夜（日语） | [昼](https://ja.wiktionary.org/wiki/%E6%98%BC) · [夜](https://ja.wiktionary.org/wiki/%E5%A4%9C) | 核对日语「昼」「夜」的具体义项，不从其他语言直接推导。 |
| 白天 | 昼（ひる） | 낮 | antonym | 낮 ↔ 밤（韩语） | [낮](https://ko.wiktionary.org/wiki/%EB%82%AE) · [밤](https://ko.wiktionary.org/wiki/%EB%B0%A4) | 核对韩语词义和语用，确认是反义而非仅为相关时间段。 |

## 本轮未纳入的关系

- **similar：0 条。** 现有词条中「希望」「盼望」「願い」「바람」存在词义和用法差异；未找到足以支持把它们作为同义或近义候选的关系型来源，因此不据直觉添加。
- **origin：0 条。** 没有逐条查到可追溯的词源资料，不创建词源候选。
- **confusable：0 条。** “容易混淆”依赖目标用户和具体语境；没有可靠证据时不把字形相似等同于易混淆。
- 上表的 antonym 也只作为待审核候选，并非已核验关系。来源页面主要用于核对词项与义项，并未在每页找到明确的成对反义声明。

## 审核判断提示

- 可先按常见核心义初筛的项目：水、雨、学校、今天等基础词的对应义；仍需核对词条义项和用法。
- 需要查词典或语料后再决定的项目：白天/昼/낮与夜/밤的反义范围、河/川/강的语义范围、以及同形多义词。
- 不能只凭中文母语直觉确认的项目：日语汉字词读音和语义范围、韩语同形多义（如「바람」）、词源、易混淆关系，以及任何跨语言近义/反义判断。

## 来源与许可

本清单链接到中、日、韩 Wiktionary 词条，供人工抽查。Wiktionary 内容通常采用 CC BY-SA 4.0 等页面所列许可，具体页面应以其版权/许可说明为准；若将其释义或其他受版权保护内容复用到产品中，应保留适当署名、许可链接及必要的相同方式共享说明。当前候选只记录词条链接，没有复制大段词典释义。
