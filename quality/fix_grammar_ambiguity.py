#!/usr/bin/env python3
"""文法：「正解以外にも成り立つ選択肢がある」問題の解消（2026-10-15）。

manual_review.json の mildUnfixed 12問に加え、同じ型で見つかった3問（g785・g788・g789。
"because of ~" が正解と同程度に成り立つ）を直す。誤答を、文法的に成り立たない語に差し替える。
正解と正解の位置は変えない。何度実行しても結果は同じ（冪等）。

  python3 tools/quality/fix_grammar_ambiguity.py [--dry-run]
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GRAMMAR = HERE.parent.parent / "src" / "data" / "grammar.json"
REVIEW = HERE / "manual_review.json"

# 設問ID → {選択肢の位置: (元の語, 新しい語)}。新しい語は、その空欄に入れると文法的に成り立たない。
FIXES = {
    "g039": {2: ("about", "of"), 3: ("at", "to")},          # pleased with（pleased about / at も可だった）
    "g050": {0: ("which", "what")},                          # 人が先行詞の関係代名詞 who
    "g109": {3: ("mandated", "mandatorily")},                # is mandatory for（mandated for も可だった）
    "g136": {1: ("at", "to"), 3: ("about", "of")},          # pleased with how ...
    "g211": {0: ("after", "in"), 2: ("until", "during")},   # before + 節（after / until も可だった）
    "g345": {0: ("for", "to")},                              # concern about（concern for も可だった）
    "g781": {1: ("because", "besides"), 2: ("regardless", "apart")},  # in view of（because of も可だった）
    "g785": {1: ("because", "besides")},                     # for the sake of（because of も可だった）
    "g787": {1: ("because", "besides"), 2: ("regardless", "apart")},  # on account of（because of も可だった）
    "g788": {0: ("because", "besides")},                     # on account of（because of も可だった）
    "g789": {1: ("because", "besides")},                     # in anticipation of（because of も可だった）
    "g841": {2: ("which", "what")},                          # 強調構文の that
    "g843": {1: ("which", "what")},                          # 強調構文の that
    "g955": {1: ("was", "been")},                            # advice is always（was も可だった）
    "g999": {0: ("create", "do")},                           # make waves（create waves も可だった）
}
NEWLY_FOUND = ["g785", "g788", "g789"]


def main():
    dry = "--dry-run" in sys.argv
    data = json.loads(GRAMMAR.read_text(encoding="utf-8"))
    by = {q["id"]: q for q in data}
    changed, problems = 0, []
    for qid, edits in FIXES.items():
        q = by[qid]
        for idx, (old, new) in edits.items():
            cur = q["choices"][idx]
            if cur == new:
                continue  # 適用済み
            if cur != old:
                problems.append(f"{qid}[{idx}]: 想定外の選択肢 {cur!r}（{old!r} のはず）")
                continue
            if idx == q["answer"]:
                problems.append(f"{qid}[{idx}]: 正解は変えない")
                continue
            if new in q["choices"]:
                problems.append(f"{qid}[{idx}]: 新しい語 {new!r} が既に選択肢にある")
                continue
            if f"({'ABCD'[idx]}) {old}" in q["explanation"]:
                problems.append(f"{qid}[{idx}]: 解説が元の選択肢に触れている")
            q["choices"][idx] = new
            changed += 1
    for p in problems:
        print("  問題", p)
    print(f"修正 {changed}か所 / 問題 {len(problems)}件")
    if dry or problems:
        return
    if changed:
        GRAMMAR.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")  # 元の書式（末尾の改行なし）

    # 手作業確認の記録：mildUnfixed を fixed へ移す
    m = json.loads(REVIEW.read_text(encoding="utf-8"))
    mild = [x["id"] for x in m["mildUnfixed"]]
    for qid in mild + NEWLY_FOUND:
        if qid not in m["fixed"]:
            m["fixed"].append(qid)
    m["mildUnfixed"] = []
    s = m["summary"]["grammar"]
    s["flagged"] = len(m["fixed"])
    s["fixed"] = len(m["fixed"])
    s["mildUnfixed"] = 0
    s["note"] = ("軽微とした12問は、誤答を差し替えて解消（fix_grammar_ambiguity.py）。"
                 "同じ型（because of が成り立つ）の3問 g785・g788・g789 も、見落としていたので同時に直した。")
    REVIEW.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")  # 元の書式（indent=1、末尾の改行なし）


if __name__ == "__main__":
    main()
