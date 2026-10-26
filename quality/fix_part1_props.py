#!/usr/bin/env python3
"""Part 1：写真に描かれていない物・動作のせいで、写真から正解を選べない30問の是正（2026-10-21）。

答えを伏せて写真を見て解いたところ、295問中30問で登録された正解と食い違った（正解の英文が述べる傘・トラック・ノートPCなどが
絵に描かれていなかった）。fixes_part1_props.json の SVG 要素を、元の絵の末尾（</svg> の直前）に足す。元の絵は変えない。
あわせて l1-38 は、乗り降りが絵で区別できないため、紛らわしい誤答 "getting off" を差し替える。
何度実行しても結果は同じ（冪等）。  python3 tools/quality/fix_part1_props.py [--dry-run]
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PATH = HERE.parent.parent / "src" / "data" / "listeningPart1.json"
DRY = "--dry-run" in sys.argv

raw = PATH.read_text(encoding="utf-8")
data = json.loads(raw)
assert json.dumps(data, ensure_ascii=False, indent=2) == raw, "書式が想定と違います"
fixes = json.loads((HERE / "fixes_part1_props.json").read_text(encoding="utf-8"))
byid = {q["id"]: q for q in data}
changed = 0
for k, v in fixes.items():
    q = byid[k]
    add = v["append"]
    if add in q["image"]:
        continue
    assert q["image"].endswith("</svg>")
    q["image"] = q["image"][: -len("</svg>")] + add + "</svg>"
    changed += 1

q = byid["l1-38"]
OLD, NEW = "A woman is getting off the bus.", "A woman is washing the bus window."
if q["choices"][0] == OLD:
    q["choices"][0] = NEW
    q["explanation"] = q["explanation"].replace(
        "(A) A woman is getting off the bus.\n  → 「getting」（〜になっている）ではなく「boarding」（乗り込んでいる、搭乗している）が正しい",
        "(A) A woman is washing the bus window.\n  → 「washing」（洗っている）ではなく「boarding」（乗り込んでいる、搭乗している）が正しい。窓を洗う動作は写真にない",
    )
    changed += 1
else:
    assert q["choices"][0] == NEW

if not DRY:
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(("(dry-run) " if DRY else "") + f"changed {changed}")
