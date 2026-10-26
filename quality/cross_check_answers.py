#!/usr/bin/env python3
"""Part 3/4・読解：解説が述べる正解と、登録された正解の機械的な突き合わせ（2026-10-19）。

  1. 解説の「(C)が正解」「選択肢B」「[正解] (A)」など、記号で述べた正解が登録された正解と食い違っていないか。
  2. 「〇〇」が正解、の引用が、登録された正解より別の選択肢に近くないか。
2026-10-19時点の結果：1は0件、2は1件（r091q5。是正済み）。
  python3 tools/quality/cross_check_answers.py
"""
import difflib
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data"
L = "ABCD"


def questions():
    for s in json.load(open(DATA / "listeningPart34.json", encoding="utf-8")):
        yield from s["questions"]
    for p in json.load(open(DATA / "readings.json", encoding="utf-8")):
        yield from p["questions"]


LETTER = [
    re.compile(r"[(（]([A-D])[)）][^。]{0,40}?が(?:正解|適切|最も適切)"),
    re.compile(r"(?:選択肢|答えは|正解は)\s*[(（]?([A-D])[)）]?"),
    re.compile(r"[(（]([A-D])[)）]\s*(?:が|は)?\s*(?:正解|適切)"),
    re.compile(r"\[正解\]\s*[(（]?([A-D])"),
]
QUOTE = re.compile(r"[「『]([^「」『』]{2,120})[」』](?:\s*(?:など)?\s*)?(?:が|は|こそが)(?:正解|最も適切|適切|本文の内容と一致|最適)")


def norm(s):
    return re.sub(r"[\s「」『』（）()。、．.,\"“”'’]", "", s).lower()


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0
    if a in b or b in a:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


bad = []
for q in questions():
    ans = q["answer"]
    for fld in ("explanation", "explanationDetail"):
        t = q.get(fld) or ""
        claimed = {m.group(1) for p in LETTER for m in p.finditer(t)}
        if claimed and L[ans] not in claimed:
            bad.append(f"{q['id']} {fld}: 正解 {L[ans]} / 解説 {sorted(claimed)}")
        for m in QUOTE.finditer(t):
            c = m.group(1)
            s = [max(sim(c, a), sim(c, b)) for a, b in zip(q["choicesJa"], q["choices"])]
            best = max(range(len(s)), key=lambda i: s[i])
            if s[best] >= 0.6 and best != ans and s[ans] < s[best]:
                bad.append(f"{q['id']} {fld}: 正解 {L[ans]} / 解説の引用「{c}」は {L[best]} に近い")
print("\n".join(bad) if bad else "食い違い 0件")
