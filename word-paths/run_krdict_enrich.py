#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一次性触发脚本：对词库中所有韩语词条调用 enrich_krdict_word，把 KRDict 数据拉进
data/krdict-enrichment.json，并把命中的敬语/平语关系写入 data/candidate-relationships.json。"""
import json
import sys
import time
from pathlib import Path

PROJECT = Path("E:/xyt/SD5913/word-paths")
sys.path.insert(0, str(PROJECT))

import source_apis  # noqa: E402

words = source_apis.load_words()
ko_words = [w for w in words if w.get("language") == "ko"]
print(f"韩语词条共 {len(ko_words)} 个，开始逐个拉取…", flush=True)

ok, failed = [], []
for w in ko_words:
    try:
        r = source_apis.enrich_krdict_word(w["id"])
        entries = len(r.get("entries", []))
        candidates = len(r.get("candidateRelationshipsAdded", []))
        cached = r.get("cached", False)
        ok.append({"id": w["id"], "word": w["word"], "entries": entries,
                   "candidates": candidates, "cached": cached})
        print(f"[OK] {w['word']}: {entries} 条释义记录, 新增候选 {candidates} (cached={cached})", flush=True)
    except Exception as exc:
        failed.append({"id": w["id"], "word": w["word"], "error": str(exc)})
        print(f"[FAIL] {w['word']}: {exc}", flush=True)
    time.sleep(0.4)

summary = {"ok": ok, "failed": failed}
summary_path = PROJECT / "data" / "krdict-enrich-run.json"
summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n完成：成功 {len(ok)}，失败 {len(failed)}。明细已写入 data/krdict-enrich-run.json", flush=True)
