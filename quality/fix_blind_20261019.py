#!/usr/bin/env python3
"""Part 2・Part 3/4・読解を答えを伏せて解き直して見つけた不具合の是正（2026-10-19）。

  - r091q5：「出発まであと2日（48時間）」なので、24時間前までのオンライン変更に当たる。登録された正解（空港のカウンター）は誤りで、
    詳細解説（explanationDetail）はオンラインを正解と述べていた。正解の位置（A）は変えず、選択肢を並べ替える。
  - l2137・l2162（Part 2）：正解以外にも応答として成り立つ誤答を、成り立たない応答に差し替える。
何度実行しても結果は同じ（冪等）。  python3 tools/quality/fix_blind_20261019.py [--dry-run]
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data"
DRY = "--dry-run" in sys.argv


def load(name):
    raw = (DATA / name).read_text(encoding="utf-8")
    d = json.loads(raw)
    assert json.dumps(d, ensure_ascii=False, indent=2) == raw, name + ": 書式が想定と違います"
    return d


def save(name, d):
    if not DRY:
        (DATA / name).write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


# ---- 読解 r091q5 ----
rd = load("readings.json")
changed = 0
for p in rd:
    for q in p["questions"]:
        if q["id"] != "r091q5":
            continue
        new = [
            "Online, since his flight is more than 24 hours away",
            "At the airport check-in counter, since his flight is within 24 hours",
            "By calling customer service only",
            "He cannot change his seat at all",
        ]
        if q["choices"] != new:
            assert q["choices"][0].startswith("At the airport") and q["answer"] == 0
            q["choices"] = new
            q["choicesJa"] = [
                "出発まで24時間以上あるため、オンラインで",
                "出発まで24時間以内であるため、空港のチェックインカウンターで",
                "カスタマーサービスへの電話のみで",
                "座席の変更は一切できない",
            ]
            q["explanation"] = "確認メールに「出発24時間前まではオンラインで変更可能」とあり、依頼メールでは「出発まであと2日」と述べているため、24時間以上前にあたり、オンラインで変更できます。"
            changed += 1
        assert q["answer"] == 0
save("readings.json", rd)

# ---- Part 2 ----
p2 = load("listeningPart2.json")
REPL = {
    "l2137": (1, "I already had a coffee break.", "The break room is on the second floor."),
    "l2162": (2, "I usually bring my own lunch.", "Around noon most days, I think."),
}
for q in p2:
    if q["id"] in REPL:
        i, old, new = REPL[q["id"]]
        if q["choices"][i] == old:
            q["choices"][i] = new
            changed += 1
        else:
            assert q["choices"][i] == new
save("listeningPart2.json", p2)
print(("(dry-run) " if DRY else "") + f"changed {changed}")
