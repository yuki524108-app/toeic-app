#!/usr/bin/env python3
"""Part 3・4の詳細解説にある「（2番目）が正解です」の番号を、現在の選択肢の位置に直す。1回限り・再実行しても何も変わらない。

  python3 tools/quality/fix_ordinals_part34.py [--dry-run]

背景: Geminiには並べ替え前の順で選択肢を渡したので、解説の「（2番目）が正解」は並べ替え前の位置を指す。
rebalance_choices.py が選択肢だけを並べ替えたため、68件で番号が古いままになっていた（(A)〜(D)の記号と同じ不具合）。
チャンク（並べ替え前の順）と、現在の選択肢の対応から、番号を直す。直した結果が answer と一致するものだけ書き換える。
"""
import glob, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "src" / "data" / "listeningPart34.json"
DRY = "--dry-run" in sys.argv
PAT = re.compile(r"([（(])([1-4])番目([）)])(?=が正解)")


def norm(s):
    return s.rstrip(".").strip()


def match(orig, cur):
    """元の選択肢 orig[i] が現在の cur のどこにあるか。誤答は修飾が足されているので、元の文で始まるものも許す。"""
    used, perm = set(), []
    for t in orig:
        j = next((k for k, c in enumerate(cur) if k not in used and (c == t or norm(c).startswith(norm(t)))), None)
        if j is None:
            return None
        used.add(j); perm.append(j)
    return perm


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {q["id"]: q for s in data for q in s["questions"]}
    orig = {}
    for cp in sorted(glob.glob(str(ROOT / "tools" / "gemini" / "part34" / "chunks" / "chunk_[0-9][0-9].json"))):
        for c in json.loads(Path(cp).read_text(encoding="utf-8")):
            for q in c["questions"]:
                orig[q["id"]] = q["choices"]
    fixed = already = skipped = 0
    for qid, q in by.items():
        d = q.get("explanationDetail") or ""
        m = PAT.search(d)
        if not m:
            continue
        n = int(m.group(2)) - 1
        if n == q["answer"]:
            already += 1
            continue
        perm = match(orig[qid], q["choices"]) if qid in orig else None
        if perm is None or perm[n] != q["answer"]:
            skipped += 1
            print(f"  見送り {qid}: 番号 {n + 1} → 対応 {None if perm is None else perm[n] + 1}、正解 {q['answer'] + 1}")
            continue
        q["explanationDetail"] = PAT.sub(lambda mm: f"{mm.group(1)}{perm[n] + 1}番目{mm.group(3)}", d, count=1)
        fixed += 1
    print(f"直した {fixed}件 / すでに正しい {already}件 / 見送り {skipped}件")
    if skipped:
        sys.exit(1)
    if not DRY:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
