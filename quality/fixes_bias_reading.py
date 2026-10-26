#!/usr/bin/env python3
"""読解（Part 7）：「正解が唯一の最長」の偏りの是正（2026-10-15）。1回限り・再実行しても何も変わらない。

  python3 tools/quality/fixes_bias_reading.py [--dry-run]

401問（57%）が「正解が唯一の最長」だった。誤答に、誤りの核を変えない修飾（場所・時期・用途など）を足して長くし、
正解の長さの順位が散らばるようにした。正解・正解の位置は変えない。
データは fixes_bias_reading_*.json（設問ID → [[誤答の位置, 英語の付け足し, 和訳の先頭に足す語句], ...]）。
  英語：元の文末の「.」の前に付け足す（「.」がない選択肢は末尾に付け足す）。
  和訳：choicesJa の先頭に語句を足す。
"""
import glob, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "src" / "data" / "readings.json"
DRY = "--dry-run" in sys.argv


def main():
    fixes = {}
    for p in sorted(glob.glob(str(HERE / "fixes_bias_reading_*.json"))):
        fixes.update(json.loads(Path(p).read_text(encoding="utf-8")))
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {q["id"]: q for s in data for q in s["questions"]}
    changed, problems = [], []
    for qid, edits in fixes.items():
        q = by[qid]
        correct = q["choices"][q["answer"]]
        staged = []
        for idx, en_add, ja_add in edits:
            old, old_ja = q["choices"][idx], q["choicesJa"][idx]
            new = (old[:-1] + en_add + ".") if old.endswith(".") else (old + en_add)
            new_ja = ja_add + old_ja
            if old.endswith(en_add) or old_ja.startswith(ja_add) and en_add in old:
                continue  # すでに修正済み
            if idx == q["answer"]:
                problems.append(f"{qid}: 差し替え位置が正解"); continue
            if len(new) <= len(correct):
                problems.append(f"{qid}[{idx}]: 新しい誤答が正解より長くない（{len(new)} <= {len(correct)}）: {new!r}"); continue
            texts = " ".join([q.get("explanation") or "", q.get("explanationDetail") or ""])
            if old_ja.rstrip("。") in texts:
                print(f"  注意 {qid}[{idx}]: 解説に元の和訳「{old_ja}」がそのまま出てくる（内容が変わらないか確認）")
            staged.append((idx, new, new_ja))
        for idx, new, new_ja in staged:
            q["choices"][idx], q["choicesJa"][idx] = new, new_ja
        if staged:
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
