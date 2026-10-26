#!/usr/bin/env python3
"""Part 6 の軽微な2空欄の是正（2026-10-21）。正解の位置は変えず、成り立つ誤答を成り立たない語に差し替える。
  p626b4: inconvenience this ___ cause → may（正解）。will も成り立つので、will → ought（to なしの ought は不可）。
  p633b3: answers ___ not be shared → will（正解）。shall / must / should も成り立つので、are / do / is に差し替える。
何度実行しても結果は同じ（冪等）。  python3 tools/quality/fix_part6_mild.py [--dry-run]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DRY = "--dry-run" in sys.argv
P6 = ROOT / "src" / "data" / "part6.json"
MR = Path(__file__).resolve().parent / "manual_review.json"

raw = P6.read_text(encoding="utf-8")
d = json.loads(raw)
assert json.dumps(d, ensure_ascii=False, indent=2) == raw
FIX = {
    "p626b4": dict(
        old=["must", "should", "will", "may"], new=["must", "should", "ought", "may"],
        ja=["〜しなければならない（助動詞）", "〜すべきである（助動詞）", "〜すべきである（ought は to を伴う）", "〜かもしれない（助動詞）"],
        dt="お詫びの定型表現「これが引き起こすかもしれないご不便（inconvenience this may cause）」を作る助動詞 may が適しています。義務を表す must や should は不自然で、ought は後ろに to が必要なためここでは入りません。"),
    "p633b3": dict(
        old=["will", "shall", "must", "should"], new=["will", "are", "do", "is"],
        ja=["～でしょう／～します（助動詞）", "～である（be動詞の複数現在）", "～する（助動詞 do）", "～である（be動詞の単数現在）"],
        dt="「回答が第三者と共有されることはない」という約束を表す助動詞 will が適しています。空欄の後ろは not be shared（受動態の原形）なので、助動詞が必要です。are・is では be が続かず、do では not be shared と組めません。"),
}
changed = 0
for p in d["passages"] if "passages" in d else d:
    for b in p["blanks"]:
        f = FIX.get(b["id"])
        if not f:
            continue
        if b["choices"] == f["old"]:
            b["choices"], b["choicesJa"], b["explanationDetail"] = f["new"], f["ja"], f["dt"]
            changed += 1
        else:
            assert b["choices"] == f["new"], b["id"]
if not DRY:
    P6.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    m = json.loads(MR.read_text(encoding="utf-8"))
    s = m["summary"]["part6"]
    if s["mildUnfixed"]:
        s["mildUnfixed"] = []
        s["fixed"] += 2
        s["note"] += " 軽微な2空欄は 2026-10-21 に fix_part6_mild.py で解消した。"
        MR.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")
print(("(dry-run) " if DRY else "") + f"changed {changed}")
