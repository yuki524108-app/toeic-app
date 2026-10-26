#!/usr/bin/env python3
"""Part 3・4の詳細解説にある「◯番目が正解」の番号を、現在の正解位置に直す（後から追加した l34-*n / *m 系の22件）。再実行しても何も変わらない。

  python3 tools/quality/fix_ordinals_part34_b.py [--dry-run]

fix_ordinals_part34.py は並べ替え前のチャンクから対応を引くが、この22件はチャンクに無く、番号が現在の answer とずれたままだった。
解説の英語の引用が、現在の正解の選択肢と同じ内容であることを目で確認したうえで、番号だけを answer+1 に直す。
"""
import json, re, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "listeningPart34.json"
PAT = re.compile(r"([1-4])番目(?=が正解)")


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    fixed = 0
    for s in data:
        for q in s["questions"]:
            d = q.get("explanationDetail") or ""
            m = PAT.search(d)
            if m and int(m.group(1)) - 1 != q["answer"]:
                q["explanationDetail"] = PAT.sub(f"{q['answer'] + 1}番目", d, count=1)
                fixed += 1
    print(f"直した {fixed}件")
    if fixed and "--dry-run" not in sys.argv:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


main()
