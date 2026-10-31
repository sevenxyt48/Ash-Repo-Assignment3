// 此文件渲染独立的 API 使用与许可页面，仅展示已接入的 API 及其条款要求。
import { applyInterfaceLanguage } from "./i18n.js";

const LANGUAGE_STORAGE_KEY = "wordpaths.language";
const LANGUAGES = ["zh", "en", "ja", "ko"];

const CONTENT = {
  zh: {
    title: "API 使用与许可",
    description: "WordPaths 已接入 API 的来源署名与许可条款。",
    eyebrow: "数据与合规",
    heading: "API 使用与许可",
    intro: "WordPaths 使用以下公开词典与语义 API。按照各服务条款，使用其内容时需保留来源署名与许可链接。",
    labels: {
      purpose: "用途",
      source: "来源",
      terms: "授权条款"
    },
    apis: [
      {
        name: "KRDict（한국어기초사전）Open API",
        purpose: "韩语词条释义、词汇等级、词性、汉字 origin 与中文翻译。",
        source: { text: "krdict.korean.go.kr", href: "https://krdict.korean.go.kr/" },
        terms: { text: "공공누리 제1유형（KOGL 1 型）", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }
      },
      {
        name: "中文维基词典 MediaWiki API",
        purpose: "词条语言章节、汉字写法、拼音、日语假名读音与词源资料。",
        source: { text: "zh.wiktionary.org", href: "https://zh.wiktionary.org/" },
        terms: { text: "CC BY-SA 4.0", href: "https://creativecommons.org/licenses/by-sa/4.0/" }
      },
      {
        name: "萌典 MoeDict",
        purpose: "中文拼音、注音、笔画与部首等补充资料。",
        source: { text: "moedict.tw", href: "https://www.moedict.tw/" },
        terms: { text: "CC BY-ND 3.0 TW", href: "https://creativecommons.org/licenses/by-nd/3.0/tw/" }
      },
      {
        name: "ConceptNet",
        purpose: "语义关系候选（近义、反义等）检索。",
        source: { text: "conceptnet.io", href: "https://conceptnet.io/" },
        terms: { text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" }
      },
      {
        name: "MyMemory 翻译记忆 API",
        purpose: "前端辅助翻译与英文参考释义。",
        source: { text: "mymemory.translated.net", href: "https://mymemory.translated.net/" },
        terms: { text: "Terms of Service", href: "https://mymemory.translated.net/terms-and-conditions" }
      },
      {
        name: "JMdict",
        purpose: "批量构建时补强日语假名读音。",
        source: { text: "edrdg.org", href: "https://www.edrdg.org/jmdict/j_jmdict.html" },
        terms: { text: "CC BY-SA 3.0", href: "https://creativecommons.org/licenses/by-sa/3.0/" }
      }
    ],
    back: "← 返回词语地图"
  },
  en: {
    title: "API usage and licences",
    description: "Source attribution and licence terms for the APIs used by WordPaths.",
    eyebrow: "DATA & COMPLIANCE",
    heading: "API usage and licences",
    intro: "WordPaths uses the public dictionary and semantic APIs below. Under each service's terms, any reuse of its content must keep the source attribution and licence link.",
    labels: {
      purpose: "Purpose",
      source: "Source",
      terms: "Licence"
    },
    apis: [
      {
        name: "KRDict (한국어기초사전) Open API",
        purpose: "Korean definitions, vocabulary grade, part of speech, hanja origin, and Chinese translations.",
        source: { text: "krdict.korean.go.kr", href: "https://krdict.korean.go.kr/" },
        terms: { text: "공공누리 Type 1 (KOGL Type 1)", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }
      },
      {
        name: "Chinese Wiktionary MediaWiki API",
        purpose: "Language sections, hanzi forms, pinyin, Japanese kana readings, and etymology material.",
        source: { text: "zh.wiktionary.org", href: "https://zh.wiktionary.org/" },
        terms: { text: "CC BY-SA 4.0", href: "https://creativecommons.org/licenses/by-sa/4.0/" }
      },
      {
        name: "MoeDict (萌典)",
        purpose: "Chinese pinyin, bopomofo, stroke count, and radical data.",
        source: { text: "moedict.tw", href: "https://www.moedict.tw/" },
        terms: { text: "CC BY-ND 3.0 TW", href: "https://creativecommons.org/licenses/by-nd/3.0/tw/" }
      },
      {
        name: "ConceptNet",
        purpose: "Semantic relationship candidates such as similar and antonym edges.",
        source: { text: "conceptnet.io", href: "https://conceptnet.io/" },
        terms: { text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" }
      },
      {
        name: "MyMemory translation memory API",
        purpose: "Front-end translation aid and English reference glosses.",
        source: { text: "mymemory.translated.net", href: "https://mymemory.translated.net/" },
        terms: { text: "Terms of Service", href: "https://mymemory.translated.net/terms-and-conditions" }
      },
      {
        name: "JMdict",
        purpose: "Bulk-build fallback for Japanese kana readings.",
        source: { text: "edrdg.org", href: "https://www.edrdg.org/jmdict/j_jmdict.html" },
        terms: { text: "CC BY-SA 3.0", href: "https://creativecommons.org/licenses/by-sa/3.0/" }
      }
    ],
    back: "← Back to the word map"
  },
  ja: {
    title: "API の利用とライセンス",
    description: "WordPaths が利用する API の出典表示とライセンス条件。",
    eyebrow: "データとコンプライアンス",
    heading: "API の利用とライセンス",
    intro: "WordPaths は以下の公開辞書 API と意味 API を利用しています。各サービスの条件に従い、内容を再利用する際は出典表示とライセンスリンクを残す必要があります。",
    labels: {
      purpose: "用途",
      source: "出典",
      terms: "ライセンス"
    },
    apis: [
      {
        name: "KRDict（한국어기초사전）Open API",
        purpose: "韓国語の語義、語彙レベル、品詞、漢字 origin、中国語訳。",
        source: { text: "krdict.korean.go.kr", href: "https://krdict.korean.go.kr/" },
        terms: { text: "공공누리 第1類型（KOGL 1 型）", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }
      },
      {
        name: "中国語版ウィクショナリー MediaWiki API",
        purpose: "項目の言語節、漢字表記、ピンイン、日本語の仮名読み、語源資料。",
        source: { text: "zh.wiktionary.org", href: "https://zh.wiktionary.org/" },
        terms: { text: "CC BY-SA 4.0", href: "https://creativecommons.org/licenses/by-sa/4.0/" }
      },
      {
        name: "萌典 MoeDict",
        purpose: "中国語のピンイン、注音、画数、部首などの補完データ。",
        source: { text: "moedict.tw", href: "https://www.moedict.tw/" },
        terms: { text: "CC BY-ND 3.0 TW", href: "https://creativecommons.org/licenses/by-nd/3.0/tw/" }
      },
      {
        name: "ConceptNet",
        purpose: "類義・反義などの意味関係候補の検索。",
        source: { text: "conceptnet.io", href: "https://conceptnet.io/" },
        terms: { text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" }
      },
      {
        name: "MyMemory 翻訳メモリ API",
        purpose: "フロントエンドの補助翻訳と英語の参考語義。",
        source: { text: "mymemory.translated.net", href: "https://mymemory.translated.net/" },
        terms: { text: "Terms of Service", href: "https://mymemory.translated.net/terms-and-conditions" }
      },
      {
        name: "JMdict",
        purpose: "一括構築時に日本語の仮名読みを補完。",
        source: { text: "edrdg.org", href: "https://www.edrdg.org/jmdict/j_jmdict.html" },
        terms: { text: "CC BY-SA 3.0", href: "https://creativecommons.org/licenses/by-sa/3.0/" }
      }
    ],
    back: "← 言葉の地図に戻る"
  },
  ko: {
    title: "API 사용 및 라이선스",
    description: "WordPaths가 사용하는 API의 출처 표시와 라이선스 조건.",
    eyebrow: "데이터와 준수 사항",
    heading: "API 사용 및 라이선스",
    intro: "WordPaths는 아래 공개 사전 API와 의미 API를 사용합니다. 각 서비스 약관에 따라 내용을 재사용할 때는 출처 표시와 라이선스 링크를 유지해야 합니다.",
    labels: {
      purpose: "용도",
      source: "출처",
      terms: "라이선스"
    },
    apis: [
      {
        name: "KRDict(한국어기초사전) Open API",
        purpose: "한국어 뜻, 어휘 등급, 품사, 한자 origin, 중국어 번역.",
        source: { text: "krdict.korean.go.kr", href: "https://krdict.korean.go.kr/" },
        terms: { text: "공공누리 제1유형(KOGL 1형)", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }
      },
      {
        name: "중국어 위키낱말사전 MediaWiki API",
        purpose: "표제어의 언어 절, 한자 표기, 병음, 일본어 가나 읽기, 어원 자료.",
        source: { text: "zh.wiktionary.org", href: "https://zh.wiktionary.org/" },
        terms: { text: "CC BY-SA 4.0", href: "https://creativecommons.org/licenses/by-sa/4.0/" }
      },
      {
        name: "MoeDict(맹전)",
        purpose: "중국어 병음, 주음, 획수, 부수 등 보강 데이터.",
        source: { text: "moedict.tw", href: "https://www.moedict.tw/" },
        terms: { text: "CC BY-ND 3.0 TW", href: "https://creativecommons.org/licenses/by-nd/3.0/tw/" }
      },
      {
        name: "ConceptNet",
        purpose: "유의·반의 등 의미 관계 후보 검색.",
        source: { text: "conceptnet.io", href: "https://conceptnet.io/" },
        terms: { text: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" }
      },
      {
        name: "MyMemory 번역 메모리 API",
        purpose: "프런트엔드 보조 번역과 영어 참고 뜻.",
        source: { text: "mymemory.translated.net", href: "https://mymemory.translated.net/" },
        terms: { text: "Terms of Service", href: "https://mymemory.translated.net/terms-and-conditions" }
      },
      {
        name: "JMdict",
        purpose: "일괄 구축 시 일본어 가나 읽기 보강.",
        source: { text: "edrdg.org", href: "https://www.edrdg.org/jmdict/j_jmdict.html" },
        terms: { text: "CC BY-SA 3.0", href: "https://creativecommons.org/licenses/by-sa/3.0/" }
      }
    ],
    back: "← 단어 지도로 돌아가기"
  }
};

const languageSelect = document.querySelector("#language");
const contentContainer = document.querySelector("#api-content");
const eyebrow = document.querySelector("#api-eyebrow");
const heading = document.querySelector("#api-title");
const intro = document.querySelector("#api-intro");
const backLink = document.querySelector("#api-back");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function link(text, href) {
  const anchor = element("a", "api-value-link", text);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  return anchor;
}

function renderApiCard(copy, api) {
  const card = element("article", "api-card");
  card.append(element("h3", "api-card-title", api.name));
  card.append(element("p", "api-card-purpose", api.purpose));
  const meta = element("dl", "api-meta");
  meta.append(element("dt", "api-meta-label", copy.labels.source));
  const sourceDetail = element("dd", "api-meta-value");
  sourceDetail.append(link(api.source.text, api.source.href));
  meta.append(sourceDetail);
  meta.append(element("dt", "api-meta-label", copy.labels.terms));
  const termsDetail = element("dd", "api-meta-value");
  termsDetail.append(link(api.terms.text, api.terms.href));
  meta.append(termsDetail);
  card.append(meta);
  return card;
}

function render(language, copy) {
  applyInterfaceLanguage(language);
  eyebrow.textContent = copy.eyebrow;
  heading.textContent = copy.heading;
  intro.textContent = copy.intro;
  backLink.textContent = copy.back;

  const grid = element("div", "api-grid");
  for (const api of copy.apis) grid.append(renderApiCard(copy, api));
  contentContainer.replaceChildren(grid);

  document.title = `${copy.title} · Word Paths`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", copy.description);
  document.documentElement.lang = language === "zh" ? "zh-CN" : language;
}

function initialLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch (error) {
    console.warn("Unable to restore the interface language:", error);
  }
  return "zh";
}

let currentLanguage = initialLanguage();
languageSelect.value = currentLanguage;
render(currentLanguage, CONTENT[currentLanguage]);

languageSelect.addEventListener("change", () => {
  currentLanguage = languageSelect.value;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  } catch (error) {
    console.warn("Unable to persist the interface language:", error);
  }
  render(currentLanguage, CONTENT[currentLanguage]);
});
