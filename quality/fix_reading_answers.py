#!/usr/bin/env python3
"""読解で、登録された正解が誤りだった問題を直す。再実行しても何も変わらない。

  python3 tools/quality/fix_reading_answers.py [--dry-run]

正解の位置（A〜D）は変えず、正しい選択肢が元の正解位置に来るよう、選択肢と和訳（choicesJa）を入れ替える。
"""
import json, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "readings.json"

# 設問ID → (正しい選択肢の（直す前の）英文, 解説（explanation）の差し替え)
FIXES = {
    "r091q5": ("Online, since his flight is more than 24 hours away", "確認メールに「出発の24時間前まではオンラインで座席変更が可能」とあり、依頼メールでは「出発まであと2日」と述べているため、オンラインで変更できます。"),
}


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {q["id"]: q for s in data for q in s["questions"]}
    fixed = 0
    for qid, (right, expl) in FIXES.items():
        q = by[qid]
        old = q["answer"]
        if q["choices"][old] == right:
            continue  # すでに直してある
        new_pos = q["choices"].index(right)
        for k in ("choices", "choicesJa"):
            q[k][old], q[k][new_pos] = q[k][new_pos], q[k][old]
        q["explanation"] = expl
        fixed += 1
        print("直した", qid)
    print(f"直した {fixed}件")
    if fixed and "--dry-run" not in sys.argv:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


main()
