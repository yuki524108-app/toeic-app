#!/usr/bin/env python3
"""Part 1：「正解が唯一の最長」の偏りの是正（2026-10-17）。1回限り・再実行しても何も変わらない。

  python3 tools/quality/fixes_bias_part1.py [--dry-run]

209問（71%）が「正解が唯一の最長」だった。誤答の文に、正解に近づかない範囲の修飾（場所・理由・道具など）を足して長くし、
正解の長さの順位が、最長・2番目・3番目・最短に散らばるようにした。
正解・正解の位置は変えない。解説の「他の選択肢が誤りである理由」に引用された誤答の文も、同じ文に直す。
データは fixes_bias_part1.json（id → {誤答の位置: 新しい文}）。
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "src" / "data" / "listeningPart1.json"
DRY = "--dry-run" in sys.argv
LET = "ABCD"


def main():
    fixes = json.loads((HERE / "fixes_bias_part1.json").read_text(encoding="utf-8"))
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {q["id"]: q for q in data}
    changed, problems = [], []
    for qid, edits in fixes.items():
        q = by[qid]
        correct = q["choices"][q["answer"]]
        todo = []
        for k, new in edits.items():
            idx = int(k)
            old = q["choices"][idx]
            if old == new:
                continue  # すでに修正済み
            if idx == q["answer"]:
                problems.append(f"{qid}: 差し替え位置が正解"); continue
            if len(new) <= len(correct):
                problems.append(f"{qid}[{idx}]: 新しい誤答が正解より長くない（{len(new)} <= {len(correct)}）"); continue
            if not new.startswith(old.rstrip(".")):
                problems.append(f"{qid}[{idx}]: 元の文で始まっていない（意味が変わる恐れ）: {old!r} → {new!r}"); continue
            todo.append((idx, old, new))
        if not todo:
            continue
        expl = q["explanation"]
        for idx, old, new in todo:
            line = f"({LET[idx]}) {old}"
            if line not in expl:
                problems.append(f"{qid}[{idx}]: 解説に「{line}」がない"); continue
            expl = expl.replace(line, f"({LET[idx]}) {new}", 1)
            q["choices"][idx] = new
        q["explanation"] = expl
        changed.append(qid)
    print(f"修正 {len(changed)}問 / 問題 {len(problems)}件")
    for m in problems:
        print("  ", m)
    if problems:
        sys.exit(1)
    if not DRY:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
