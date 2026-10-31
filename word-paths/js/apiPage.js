// 此文件渲染独立的 API 使用与许可页面，并按界面语言切换全部内容。
import { applyInterfaceLanguage } from "./i18n.js";

const LANGUAGE_STORAGE_KEY = "wordpaths.language";
const LANGUAGES = ["zh", "en", "ja", "ko"];

const CONTENT = {
  zh: {
    title: "API 使用与许可",
    description: "WordPaths 的 API 使用清单、授权条款与合规说明。",
    eyebrow: "数据与合规",
    heading: "API 使用与许可",
    intro: "WordPaths 只调用公开词典与语义 API，并遵循各自的授权条款。以下列出当前正式接入的服务、调研评估过但未接入的服务，以及部署时必须遵守的署名与许可要求。",
    updated: "数据截至 2026-11-01，来源：项目代码 source_apis.py / server.py / js/* 与各 API 官方文档。",
    sections: {
      production: "一、正式接入的 API（生产数据流）",
      excluded: "二、调研评估过但未接入",
      notes: "三、合规注意事项"
    },
    labels: {
      purpose: "用途",
      endpoint: "端点",
      integration: "接入",
      auth: "认证",
      quota: "限额",
      terms: "授权条款",
      docs: "文档",
      reason: "未接入原因",
      source: "数据来源"
    },
    apis: [
      {
        name: "KRDict（한국어기초사전）Open API",
        fields: [
          ["purpose", "韩语词条释义、词汇等级（초급/중급/고급）、词性、汉字 origin、中文翻译（trans_lang=11）；韩语词详情页与批量拉取"],
          ["endpoint", { text: "https://krdict.korean.go.kr/api/search", href: "https://krdict.korean.go.kr/api/search" }],
          ["integration", "服务端 source_apis.py 封装；server.py 路由 /api/krdict/search、/api/krdict/enrich；前端韩语词详情按 KRDict + 维基词典双源查询"],
          ["auth", "免费申请 authentication key（KRDICT_API_KEY 存 .env，仅服务端）；注册需韩国手机实名认证"],
          ["quota", "每天 50,000 次调用；错误码 020 = key 未注册，010 = 当日限额"],
          ["terms", "공공누리 제1유형（KOGL 1 型）——可自由使用、复制、修改、分发，商用需注明出处"],
          ["docs", { text: "https://krdict.korean.go.kr/kor/openApi/openApiInfo", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }]
        ]
      },
      {
        name: "中文维基词典 MediaWiki API",
        fields: [
          ["purpose", "词条语言章节提取（汉字写法、拼音、日语假名读音）、词源/字源资料（etymology-sources.json）"],
          ["endpoint", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }],
          ["integration", "source_apis.fetch_wiktionary_page / enrich_wiktionary_word；server.py 路由 /api/wiktionary/enrich；前端详情页词源查询"],
          ["auth", "免 key；必须带描述性 User-Agent（项目内置 WordPaths/1.0 + 仓库链接），裸 UA 会 403"],
          ["quota", "无固定配额；需避免高频请求，失败时前端展示来源查询状态"],
          ["terms", "内容 CC BY-SA 4.0（署名 + 相同方式共享）；词源片段须记录获取时间、来源链接与归属"],
          ["docs", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }]
        ]
      },
      {
        name: "萌典 MoeDict",
        fields: [
          ["purpose", "中文侧补强：拼音（pinyin）、注音（bopomofo）、笔画（stroke_count）、部首（radical）；2026-10-31 批次 257 簇构建中补拼音"],
          ["endpoint", { text: "https://www.moedict.tw/uni/", href: "https://www.moedict.tw/uni/" }],
          ["integration", "批量构建脚本直接匿名 GET；结果写入词库字段，不在前端实时请求"],
          ["auth", "免 key、匿名 GET、CORS 开放；仅支持繁体汉字"],
          ["quota", "无公开限额；批量任务控制并发频率"],
          ["terms", "前端代码 CC0；词典语料 CC BY-ND 3.0 TW（公开部署需署名、禁止改作）"],
          ["docs", { text: "https://www.moedict.tw/", href: "https://www.moedict.tw/" }]
        ]
      },
      {
        name: "ConceptNet",
        fields: [
          ["purpose", "语义关系候选（近义/反义等）检索，经 server.py /api/conceptnet 代理；原始关系不直接成为已核验关系（PRD 5.4）"],
          ["endpoint", { text: "https://api.conceptnet.io/c/{language}/{word}?limit=100", href: "https://api.conceptnet.io/" }],
          ["integration", "server.py 代理路由 /api/conceptnet；前端搜索与候选关系展示"],
          ["auth", "公开 API，免 key"],
          ["quota", "无公开限额；请求需附带描述性 UA，失败时前端提示可用状态"],
          ["terms", "数据 CC BY 4.0（署名 + 链接许可证 + 标明修改）；单条数据以 edge 的 license 字段为准"],
          ["docs", { text: "https://conceptnet.io/", href: "https://conceptnet.io/" }]
        ]
      },
      {
        name: "MyMemory 翻译记忆 API",
        fields: [
          ["purpose", "前端辅助翻译（js/vocabularyApi.js），用于英文悬浮翻译等参考释义"],
          ["endpoint", { text: "https://api.mymemory.translated.net/get", href: "https://api.mymemory.translated.net/get" }],
          ["integration", "前端 js/vocabularyApi.js 直接调用；失败时回落本地词库释义"],
          ["auth", "匿名免费；提供 email（de 参数）可提升额度"],
          ["quota", "匿名 5,000 字符/天；提供 email 后 50,000 字符/天"],
          ["terms", "免费翻译记忆服务，使用须遵守其 Terms of Service"],
          ["docs", { text: "https://mymemory.translated.net/doc/", href: "https://mymemory.translated.net/doc/" }]
        ]
      },
      {
        name: "JMdict（批量构建备用）",
        fields: [
          ["purpose", "2026-10-31 批次 batch3（64 簇）日语假名读音补强（维基词典不可达时的备用源）"],
          ["endpoint", "EDRDG 官方发布的 JMdict 词典文件（离线批量处理）"],
          ["integration", "批量构建脚本读取本地词典文件，结果写入词库 reading 字段"],
          ["auth", "免费公开数据"],
          ["quota", "离线文件，无调用限额"],
          ["terms", "EDRDG 词典文件 CC BY-SA 3.0（署名 + 相同方式共享；衍生文件须保持相同许可）"],
          ["docs", { text: "https://www.edrdg.org/jmdict/j_jmdict.html", href: "https://www.edrdg.org/jmdict/j_jmdict.html" }]
        ]
      }
    ],
    excluded: [
      ["English Wiktionary", "免 key，含 Category:Korean honorific terms 等结构化敬语分类；仅作为调研备选，未进入生产数据流。"],
      ["표준국어대사전", "无敬语专用字段，注册同样需韩国手机实名认证；未接入。"],
      ["Naver 词典", "Search API 已于 2026-07-31 终止并转为付费服务；已排除。"],
      ["Daum 词典", "无公开 API；已排除。"],
      ["中华语文知识库 chinese-linguipedia.org", "无官方公开 API 授权，版权归中華文化總會；已排除。"],
      ["汉典 / 小學堂 / 异体字字典", "无文档化 API；已排除。"]
    ],
    notes: [
      "署名义务：KRDict（KOGL 1 型）、维基词典（CC BY-SA 4.0）、萌典（CC BY-ND 3.0 TW）、ConceptNet（CC BY 4.0）、JMdict（CC BY-SA 3.0）均需在展示/部署处注明来源与许可链接。",
      "词源等 CC BY-SA 内容写入独立来源 JSON（含获取时间、来源链接、归属）。",
      "KRDict key 仅存服务端 .env，不进入前端或提交仓库。",
      "维基词典请求必须带描述性 UA，并避免高频请求。",
      "各 API 请求失败时前端应展示来源查询状态，不静默失败。"
    ],
    back: "← 返回词语地图"
  },
  en: {
    title: "API usage and licences",
    description: "WordPaths API usage list, licence terms, and compliance notes.",
    eyebrow: "DATA & COMPLIANCE",
    heading: "API usage and licences",
    intro: "WordPaths calls only public dictionary and semantic APIs and follows each service's terms. Below are the services currently integrated, the ones evaluated but not integrated, and the attribution and licence requirements that apply when deployed.",
    updated: "Data as of 2026-11-01, compiled from source_apis.py / server.py / js/* and each API's official documentation.",
    sections: {
      production: "1. APIs in production",
      excluded: "2. Evaluated but not integrated",
      notes: "3. Compliance notes"
    },
    labels: {
      purpose: "Purpose",
      endpoint: "Endpoint",
      integration: "Integration",
      auth: "Authentication",
      quota: "Rate limits",
      terms: "Licence terms",
      docs: "Documentation",
      reason: "Reason for exclusion",
      source: "Data source"
    },
    apis: [
      {
        name: "KRDict (한국어기초사전) Open API",
        fields: [
          ["purpose", "Korean definitions, vocabulary grade (초급/중급/고급), part of speech, hanja origin, and Chinese translations (trans_lang=11); used by the Korean word detail page and bulk imports"],
          ["endpoint", { text: "https://krdict.korean.go.kr/api/search", href: "https://krdict.korean.go.kr/api/search" }],
          ["integration", "Wrapped server-side in source_apis.py; server.py routes /api/krdict/search and /api/krdict/enrich; the Korean detail view queries KRDict and Wiktionary together"],
          ["auth", "Free authentication key (KRDICT_API_KEY kept in server-side .env only); registration requires Korean mobile identity verification"],
          ["quota", "50,000 calls per day; error 020 = key not registered, 010 = daily limit reached"],
          ["terms", "공공누리 Type 1 (KOGL Type 1): free to use, copy, modify, and distribute; commercial use requires attribution"],
          ["docs", { text: "https://krdict.korean.go.kr/kor/openApi/openApiInfo", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }]
        ]
      },
      {
        name: "Chinese Wiktionary MediaWiki API",
        fields: [
          ["purpose", "Language-section extraction (hanzi forms, pinyin, Japanese kana readings) and etymology material (etymology-sources.json)"],
          ["endpoint", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }],
          ["integration", "source_apis.fetch_wiktionary_page / enrich_wiktionary_word; server.py route /api/wiktionary/enrich; etymology lookup on the detail page"],
          ["auth", "No key; a descriptive User-Agent is required (built-in WordPaths/1.0 plus repository link). A bare UA returns 403"],
          ["quota", "No fixed quota; avoid high-frequency requests and show source lookup status when a call fails"],
          ["terms", "Content is CC BY-SA 4.0 (attribution + share-alike); etymology excerpts must record retrieval time, source link, and attribution"],
          ["docs", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }]
        ]
      },
      {
        name: "MoeDict (萌典)",
        fields: [
          ["purpose", "Chinese-side enrichment: pinyin, bopomofo, stroke count, radical; pinyin added during the 2026-10-31 build of 257 clusters"],
          ["endpoint", { text: "https://www.moedict.tw/uni/", href: "https://www.moedict.tw/uni/" }],
          ["integration", "Bulk scripts request it anonymously; results are stored in the dataset rather than fetched live by the front end"],
          ["auth", "No key, anonymous GET, CORS open; traditional Chinese characters only"],
          ["quota", "No published quota; bulk jobs throttle concurrency"],
          ["terms", "Front-end code CC0; dictionary corpus CC BY-ND 3.0 TW (public deployment requires attribution, no derivative works)"],
          ["docs", { text: "https://www.moedict.tw/", href: "https://www.moedict.tw/" }]
        ]
      },
      {
        name: "ConceptNet",
        fields: [
          ["purpose", "Semantic relationship candidates (similar, antonym, etc.) proxied through server.py /api/conceptnet; raw edges never become verified relationships directly (PRD 5.4)"],
          ["endpoint", { text: "https://api.conceptnet.io/c/{language}/{word}?limit=100", href: "https://api.conceptnet.io/" }],
          ["integration", "server.py proxy route /api/conceptnet; used for search and candidate relation display"],
          ["auth", "Public API, no key"],
          ["quota", "No published quota; requests need a descriptive UA and failures surface in the UI"],
          ["terms", "Data CC BY 4.0 (attribution + licence link + indicate changes); the per-edge license field takes precedence"],
          ["docs", { text: "https://conceptnet.io/", href: "https://conceptnet.io/" }]
        ]
      },
      {
        name: "MyMemory translation memory API",
        fields: [
          ["purpose", "Front-end translation aid (js/vocabularyApi.js), including English hover translations"],
          ["endpoint", { text: "https://api.mymemory.translated.net/get", href: "https://api.mymemory.translated.net/get" }],
          ["integration", "Called directly by js/vocabularyApi.js; falls back to local definitions when unavailable"],
          ["auth", "Free anonymously; supplying an email (de parameter) raises the quota"],
          ["quota", "5,000 characters/day anonymously; 50,000 characters/day with an email"],
          ["terms", "Free translation-memory service; use is subject to its Terms of Service"],
          ["docs", { text: "https://mymemory.translated.net/doc/", href: "https://mymemory.translated.net/doc/" }]
        ]
      },
      {
        name: "JMdict (bulk-build fallback)",
        fields: [
          ["purpose", "Japanese kana readings for batch3 (64 clusters) in the 2026-10-31 build, used as a fallback when Wiktionary is unreachable"],
          ["endpoint", "Official JMdict dictionary files published by EDRDG (offline bulk processing)"],
          ["integration", "Bulk scripts read the local dictionary file and write results into the reading field"],
          ["auth", "Free public data"],
          ["quota", "Offline files, no call limits"],
          ["terms", "EDRDG dictionary files CC BY-SA 3.0 (attribution + share-alike; derivative files must keep the same licence)"],
          ["docs", { text: "https://www.edrdg.org/jmdict/j_jmdict.html", href: "https://www.edrdg.org/jmdict/j_jmdict.html" }]
        ]
      }
    ],
    excluded: [
      ["English Wiktionary", "No key and structured honorific categories such as Category:Korean honorific terms; kept as a research option, not part of the production data flow."],
      ["표준국어대사전", "No dedicated honorific fields, and registration also requires Korean mobile identity verification; not integrated."],
      ["Naver Dictionary", "Its Search API was discontinued on 2026-07-31 and moved to a paid tier; excluded."],
      ["Daum Dictionary", "No public API; excluded."],
      ["chinese-linguipedia.org", "No official public API licence, and copyright belongs to the 中華文化總會; excluded."],
      ["汉典 / 小學堂 / 异体字字典", "No documented API; excluded."]
    ],
    notes: [
      "Attribution: KRDict (KOGL Type 1), Wiktionary (CC BY-SA 4.0), MoeDict (CC BY-ND 3.0 TW), ConceptNet (CC BY 4.0), and JMdict (CC BY-SA 3.0) all require a visible source and licence link wherever content is displayed or deployed.",
      "CC BY-SA material such as etymology excerpts is stored in dedicated source JSON files with retrieval time, source link, and attribution.",
      "The KRDict key stays in server-side .env and never reaches the front end or the repository.",
      "Wiktionary requests must send a descriptive UA and avoid high-frequency calls.",
      "When any API call fails, the UI must show the source lookup status instead of failing silently."
    ],
    back: "← Back to the word map"
  },
  ja: {
    title: "API の利用とライセンス",
    description: "WordPaths が利用する API の一覧、ライセンス条項、コンプライアンス上の注意。",
    eyebrow: "データとコンプライアンス",
    heading: "API の利用とライセンス",
    intro: "WordPaths は公開されている辞書 API と意味 API のみを利用し、それぞれの利用条件に従います。以下に、現在導入しているサービス、検討したが導入していないサービス、および公開時に守るべき出典表示とライセンス要件を示します。",
    updated: "データは 2026-11-01 時点。出典：プロジェクトコード source_apis.py / server.py / js/* と各 API の公式ドキュメント。",
    sections: {
      production: "一、導入済みの API（本番データフロー）",
      excluded: "二、検討したが未導入",
      notes: "三、コンプライアンス上の注意"
    },
    labels: {
      purpose: "用途",
      endpoint: "エンドポイント",
      integration: "実装",
      auth: "認証",
      quota: "利用上限",
      terms: "ライセンス条項",
      docs: "ドキュメント",
      reason: "未導入の理由",
      source: "データ出典"
    },
    apis: [
      {
        name: "KRDict（한국어기초사전）Open API",
        fields: [
          ["purpose", "韓国語の語義、語彙レベル（초급/중급/고급）、品詞、漢字 origin、中国語訳（trans_lang=11）。韓国語の詳細ページと一括取得で利用"],
          ["endpoint", { text: "https://krdict.korean.go.kr/api/search", href: "https://krdict.korean.go.kr/api/search" }],
          ["integration", "サーバー側 source_apis.py でラップ。server.py のルート /api/krdict/search と /api/krdict/enrich。韓国語の詳細は KRDict とウィクショナリーの二系統で照会"],
          ["auth", "無料の authentication key（KRDICT_API_KEY はサーバー側 .env のみ）。登録には韓国の携帯電話による本人確認が必要"],
          ["quota", "1 日 50,000 回。エラー 020 = key 未登録、010 = 当日上限"],
          ["terms", "공공누리 第1類型（KOGL 1 型）：自由な利用・複製・改変・配布が可能。商用利用時は出典明記が必要"],
          ["docs", { text: "https://krdict.korean.go.kr/kor/openApi/openApiInfo", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }]
        ]
      },
      {
        name: "中国語版ウィクショナリー MediaWiki API",
        fields: [
          ["purpose", "項目の言語節の抽出（漢字表記、ピンイン、日本語の仮名読み）、語源・字源資料（etymology-sources.json）"],
          ["endpoint", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }],
          ["integration", "source_apis.fetch_wiktionary_page / enrich_wiktionary_word、server.py のルート /api/wiktionary/enrich、詳細ページの語源照会"],
          ["auth", "key 不要。ただし説明的な User-Agent（WordPaths/1.0 とリポジトリリンクを内蔵）が必須で、裸の UA は 403 になります"],
          ["quota", "固定上限なし。高頻度のリクエストを避け、失敗時は照会状態を表示します"],
          ["terms", "本文は CC BY-SA 4.0（出典明記＋同一条件での共有）。語源の抜粋には取得日時・出典リンク・帰属を記録"],
          ["docs", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }]
        ]
      },
      {
        name: "萌典 MoeDict",
        fields: [
          ["purpose", "中国語側の補完：ピンイン、注音、画数、部首。2026-10-31 の 257 クラスタ構築でピンインを補完"],
          ["endpoint", { text: "https://www.moedict.tw/uni/", href: "https://www.moedict.tw/uni/" }],
          ["integration", "一括構築スクリプトが匿名で GET。結果は語彙データに保存し、フロントエンドで都度取得はしません"],
          ["auth", "key 不要、匿名 GET、CORS 公開。繁体字のみ対応"],
          ["quota", "公開された上限なし。一括処理では同時実行を抑制"],
          ["terms", "フロントエンドのコードは CC0。辞書本文は CC BY-ND 3.0 TW（公開時は出典明記、改変禁止）"],
          ["docs", { text: "https://www.moedict.tw/", href: "https://www.moedict.tw/" }]
        ]
      },
      {
        name: "ConceptNet",
        fields: [
          ["purpose", "意味関係の候補（類義・反義など）の検索。server.py /api/conceptnet 経由。生の関係はそのまま検証済み関係にはなりません（PRD 5.4）"],
          ["endpoint", { text: "https://api.conceptnet.io/c/{language}/{word}?limit=100", href: "https://api.conceptnet.io/" }],
          ["integration", "server.py のプロキシルート /api/conceptnet。検索と候補関係の表示に使用"],
          ["auth", "公開 API、key 不要"],
          ["quota", "公開された上限なし。説明的な UA を付け、失敗時は UI に状態を表示"],
          ["terms", "データは CC BY 4.0（出典明記＋ライセンスリンク＋変更の明示）。個別データは edge の license フィールドが優先"],
          ["docs", { text: "https://conceptnet.io/", href: "https://conceptnet.io/" }]
        ]
      },
      {
        name: "MyMemory 翻訳メモリ API",
        fields: [
          ["purpose", "フロントエンドの補助翻訳（js/vocabularyApi.js）。英語のホバー訳などに使用"],
          ["endpoint", { text: "https://api.mymemory.translated.net/get", href: "https://api.mymemory.translated.net/get" }],
          ["integration", "js/vocabularyApi.js から直接呼び出し。利用できない場合はローカル語義にフォールバック"],
          ["auth", "匿名で無料。email（de パラメータ）を指定すると上限が上がります"],
          ["quota", "匿名 5,000 文字/日、email 指定で 50,000 文字/日"],
          ["terms", "無料の翻訳メモリサービス。利用には Terms of Service が適用されます"],
          ["docs", { text: "https://mymemory.translated.net/doc/", href: "https://mymemory.translated.net/doc/" }]
        ]
      },
      {
        name: "JMdict（一括構築の予備）",
        fields: [
          ["purpose", "2026-10-31 の batch3（64 クラスタ）で日本語の仮名読みを補完（ウィクショナリーに到達できない場合の予備）"],
          ["endpoint", "EDRDG が公開する JMdict 辞書ファイル（オフライン一括処理）"],
          ["integration", "一括スクリプトがローカルの辞書ファイルを読み、reading フィールドに書き込み"],
          ["auth", "無料の公開データ"],
          ["quota", "オフラインファイルのため呼び出し上限なし"],
          ["terms", "EDRDG 辞書ファイルは CC BY-SA 3.0（出典明記＋同一条件での共有。派生ファイルも同じライセンスを維持）"],
          ["docs", { text: "https://www.edrdg.org/jmdict/j_jmdict.html", href: "https://www.edrdg.org/jmdict/j_jmdict.html" }]
        ]
      }
    ],
    excluded: [
      ["English Wiktionary", "key 不要で Category:Korean honorific terms などの敬語カテゴリを持つが、調査用の候補であり本番データフローには含めていません。"],
      ["표준국어대사전", "敬語専用のフィールドがなく、登録にも韓国の携帯電話による本人確認が必要。未導入。"],
      ["Naver 辞書", "Search API は 2026-07-31 に終了し有料化。除外。"],
      ["Daum 辞書", "公開 API なし。除外。"],
      ["中華語文知識庫 chinese-linguipedia.org", "公式の公開 API ライセンスがなく、著作権は中華文化總會に帰属。除外。"],
      ["漢典 / 小學堂 / 異体字字典", "文書化された API なし。除外。"]
    ],
    notes: [
      "出典表示：KRDict（KOGL 1 型）、ウィクショナリー（CC BY-SA 4.0）、萌典（CC BY-ND 3.0 TW）、ConceptNet（CC BY 4.0）、JMdict（CC BY-SA 3.0）は、表示・公開の箇所に出典とライセンスリンクを明記する必要があります。",
      "語源など CC BY-SA の内容は、取得日時・出典リンク・帰属を含む専用の出典 JSON に記録します。",
      "KRDict の key はサーバー側 .env のみに保存し、フロントエンドやリポジトリには含めません。",
      "ウィクショナリーへのリクエストには説明的な UA を付け、高頻度の呼び出しを避けます。",
      "各 API の呼び出しが失敗した場合は、黙って失敗させず、出典照会の状態を UI に表示します。"
    ],
    back: "← 言葉の地図に戻る"
  },
  ko: {
    title: "API 사용 및 라이선스",
    description: "WordPaths의 API 사용 목록, 라이선스 조건, 준수 사항.",
    eyebrow: "데이터와 준수 사항",
    heading: "API 사용 및 라이선스",
    intro: "WordPaths는 공개된 사전 및 의미 API만 호출하며 각 서비스의 약관을 따릅니다. 아래에 현재 운영에 연결된 서비스, 검토했지만 연결하지 않은 서비스, 그리고 배포 시 지켜야 할 출처 표시와 라이선스 요구 사항을 정리했습니다.",
    updated: "데이터 기준일 2026-11-01. 출처: 프로젝트 코드 source_apis.py / server.py / js/* 및 각 API 공식 문서.",
    sections: {
      production: "1. 운영에 연결된 API",
      excluded: "2. 검토했으나 연결하지 않은 API",
      notes: "3. 준수 사항"
    },
    labels: {
      purpose: "용도",
      endpoint: "엔드포인트",
      integration: "연결 방식",
      auth: "인증",
      quota: "호출 한도",
      terms: "라이선스 조건",
      docs: "문서",
      reason: "미연결 이유",
      source: "데이터 출처"
    },
    apis: [
      {
        name: "KRDict(한국어기초사전) Open API",
        fields: [
          ["purpose", "한국어 뜻, 어휘 등급(초급/중급/고급), 품사, 한자 origin, 중국어 번역(trans_lang=11). 한국어 상세 페이지와 일괄 수집에 사용"],
          ["endpoint", { text: "https://krdict.korean.go.kr/api/search", href: "https://krdict.korean.go.kr/api/search" }],
          ["integration", "서버 측 source_apis.py에서 래핑. server.py 라우트 /api/krdict/search, /api/krdict/enrich. 한국어 상세는 KRDict와 위키낱말사전 두 출처로 조회"],
          ["auth", "무료 authentication key 신청(KRDICT_API_KEY는 서버 .env에만 보관). 등록 시 한국 휴대전화 본인 인증 필요"],
          ["quota", "하루 50,000회. 오류 020 = key 미등록, 010 = 당일 한도"],
          ["terms", "공공누리 제1유형(KOGL 1형): 자유로운 사용·복제·수정·배포 가능, 상업적 이용 시 출처 표시 필요"],
          ["docs", { text: "https://krdict.korean.go.kr/kor/openApi/openApiInfo", href: "https://krdict.korean.go.kr/kor/openApi/openApiInfo" }]
        ]
      },
      {
        name: "중국어 위키낱말사전 MediaWiki API",
        fields: [
          ["purpose", "표제어의 언어 절 추출(한자 표기, 병음, 일본어 가나 읽기), 어원·자원 자료(etymology-sources.json)"],
          ["endpoint", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }],
          ["integration", "source_apis.fetch_wiktionary_page / enrich_wiktionary_word, server.py 라우트 /api/wiktionary/enrich, 상세 페이지 어원 조회"],
          ["auth", "key 불필요. 설명형 User-Agent가 필수(WordPaths/1.0 + 저장소 링크 내장). 기본 UA는 403이 반환됩니다"],
          ["quota", "고정 한도 없음. 고빈도 요청을 피하고 실패 시 조회 상태를 표시"],
          ["terms", "내용은 CC BY-SA 4.0(출처 표시 + 동일 조건 공유). 어원 발췌에는 조회 시각, 출처 링크, 귀속 정보를 기록"],
          ["docs", { text: "https://zh.wiktionary.org/w/api.php", href: "https://zh.wiktionary.org/w/api.php" }]
        ]
      },
      {
        name: "MoeDict(맹전)",
        fields: [
          ["purpose", "중국어 측 보강: 병음, 주음, 획수, 부수. 2026-10-31 257개 클러스터 구축에서 병음 보강"],
          ["endpoint", { text: "https://www.moedict.tw/uni/", href: "https://www.moedict.tw/uni/" }],
          ["integration", "일괄 스크립트가 익명으로 GET. 결과는 데이터셋 필드에 저장되며 프런트엔드에서 실시간 호출하지 않음"],
          ["auth", "key 불필요, 익명 GET, CORS 개방. 번체 한자만 지원"],
          ["quota", "공개된 한도 없음. 일괄 작업은 동시 실행을 제한"],
          ["terms", "프런트엔드 코드는 CC0. 사전 말뭉치는 CC BY-ND 3.0 TW(공개 배포 시 출처 표시, 개작 금지)"],
          ["docs", { text: "https://www.moedict.tw/", href: "https://www.moedict.tw/" }]
        ]
      },
      {
        name: "ConceptNet",
        fields: [
          ["purpose", "의미 관계 후보(유의·반의 등) 검색. server.py /api/conceptnet 경유. 원시 관계는 검증된 관계로 직접 승격되지 않음(PRD 5.4)"],
          ["endpoint", { text: "https://api.conceptnet.io/c/{language}/{word}?limit=100", href: "https://api.conceptnet.io/" }],
          ["integration", "server.py 프록시 라우트 /api/conceptnet. 검색과 후보 관계 표시에 사용"],
          ["auth", "공개 API, key 불필요"],
          ["quota", "공개된 한도 없음. 설명형 UA를 붙이고 실패 시 UI에 상태 표시"],
          ["terms", "데이터는 CC BY 4.0(출처 표시 + 라이선스 링크 + 변경 표시). 개별 데이터는 edge의 license 필드가 우선"],
          ["docs", { text: "https://conceptnet.io/", href: "https://conceptnet.io/" }]
        ]
      },
      {
        name: "MyMemory 번역 메모리 API",
        fields: [
          ["purpose", "프런트엔드 보조 번역(js/vocabularyApi.js). 영어 호버 번역 등에 사용"],
          ["endpoint", { text: "https://api.mymemory.translated.net/get", href: "https://api.mymemory.translated.net/get" }],
          ["integration", "js/vocabularyApi.js에서 직접 호출. 사용할 수 없으면 로컬 뜻으로 대체"],
          ["auth", "익명 무료. email(de 매개변수) 제공 시 한도 상향"],
          ["quota", "익명 5,000자/일, email 제공 시 50,000자/일"],
          ["terms", "무료 번역 메모리 서비스로, 이용 시 Terms of Service를 준수해야 합니다"],
          ["docs", { text: "https://mymemory.translated.net/doc/", href: "https://mymemory.translated.net/doc/" }]
        ]
      },
      {
        name: "JMdict(일괄 구축 예비 출처)",
        fields: [
          ["purpose", "2026-10-31 batch3(64개 클러스터) 일본어 가나 읽기 보강. 위키낱말사전 접근 불가 시 예비 출처"],
          ["endpoint", "EDRDG가 배포하는 JMdict 사전 파일(오프라인 일괄 처리)"],
          ["integration", "일괄 스크립트가 로컬 사전 파일을 읽어 reading 필드에 기록"],
          ["auth", "무료 공개 데이터"],
          ["quota", "오프라인 파일이라 호출 한도 없음"],
          ["terms", "EDRDG 사전 파일은 CC BY-SA 3.0(출처 표시 + 동일 조건 공유, 파생 파일도 같은 라이선스 유지)"],
          ["docs", { text: "https://www.edrdg.org/jmdict/j_jmdict.html", href: "https://www.edrdg.org/jmdict/j_jmdict.html" }]
        ]
      }
    ],
    excluded: [
      ["English Wiktionary", "key가 필요 없고 Category:Korean honorific terms 같은 구조화된 존대 분류가 있으나, 조사용 후보로만 두고 운영 데이터 흐름에는 포함하지 않음."],
      ["표준국어대사전", "존대 전용 필드가 없고 등록에도 한국 휴대전화 본인 인증이 필요. 연결하지 않음."],
      ["Naver 사전", "Search API가 2026-07-31 종료되어 유료로 전환. 제외."],
      ["Daum 사전", "공개 API 없음. 제외."],
      ["중화어문지식고 chinese-linguipedia.org", "공식 공개 API 라이선스가 없고 저작권은 中華文化總會에 귀속. 제외."],
      ["한전 / 小學堂 / 이체자사전", "문서화된 API 없음. 제외."]
    ],
    notes: [
      "출처 표시 의무: KRDict(KOGL 1형), 위키낱말사전(CC BY-SA 4.0), 맹전(CC BY-ND 3.0 TW), ConceptNet(CC BY 4.0), JMdict(CC BY-SA 3.0) 모두 표시·배포 지점에 출처와 라이선스 링크를 명시해야 합니다.",
      "어원 등 CC BY-SA 내용은 조회 시각, 출처 링크, 귀속 정보를 포함한 별도 출처 JSON에 기록합니다.",
      "KRDict key는 서버 측 .env에만 저장하고 프런트엔드나 저장소에 포함하지 않습니다.",
      "위키낱말사전 요청에는 설명형 UA를 붙이고 고빈도 호출을 피해야 합니다.",
      "각 API 호출이 실패하면 조용히 넘기지 말고 출처 조회 상태를 UI에 표시해야 합니다."
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

function fieldValue(tag, value) {
  if (typeof value === "string") return element(tag, "api-value", value);
  const link = element("a", "api-value api-value-link", value.text);
  link.href = value.href;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

function renderApiCard(copy, api) {
  const card = element("article", "api-card");
  card.append(element("h3", "api-card-title", api.name));
  const meta = element("dl", "api-meta");
  for (const [key, value] of api.fields) {
    const term = element("dt", "api-meta-label", copy.labels[key] ?? key);
    const detail = element("dd", "api-meta-value");
    detail.append(fieldValue("span", value));
    meta.append(term, detail);
  }
  card.append(meta);
  return card;
}

function render(language, copy) {
  applyInterfaceLanguage(language);
  eyebrow.textContent = copy.eyebrow;
  heading.textContent = copy.heading;
  intro.textContent = copy.intro;
  backLink.textContent = copy.back;

  const nodes = [element("p", "api-updated", copy.updated)];

  nodes.push(element("h2", "api-section-title", copy.sections.production));
  const grid = element("div", "api-grid");
  for (const api of copy.apis) grid.append(renderApiCard(copy, api));
  nodes.push(grid);

  nodes.push(element("h2", "api-section-title", copy.sections.excluded));
  const excluded = element("ul", "api-excluded");
  for (const [name, reason] of copy.excluded) {
    const item = element("li", "api-excluded-item");
    item.append(element("strong", "api-excluded-name", name));
    item.append(element("span", "api-excluded-reason", reason));
    excluded.append(item);
  }
  nodes.push(excluded);

  nodes.push(element("h2", "api-section-title", copy.sections.notes));
  const notes = element("ol", "api-notes");
  for (const note of copy.notes) notes.append(element("li", "api-note", note));
  nodes.push(notes);

  contentContainer.replaceChildren(...nodes);
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
