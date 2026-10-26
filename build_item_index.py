#!/usr/bin/env python3
"""
問題データの索引（src/data/itemIndex.json）を生成する。

ホーム画面は「今日復習する問題の数」を数えるためだけに問題データ（約5MB）を読み込んでいた。
IDだけを集めた小さな索引（約80KB）で数えられるようにし、問題データは各学習画面を開くときに読み込む。

  python3 tools/build_item_index.py          # 索引を生成して src/data/itemIndex.json に書き出す
  python3 tools/build_item_index.py --check  # 索引が問題データと一致しているか検査する（ずれていれば終了コード1）

あわせて、文法の「設問ID → 文法項目（カテゴリ）」の対応（src/data/grammarCategories.json、約20KB）も作る。
進捗画面の「文法項目別の正答率」は、カテゴリ名を引くためだけに文法の問題データ（約640KB）を読み込んでいた。

問題データ（src/data/*.json）を更新したら、このスクリプトを実行して索引を作り直す。
一致しているかは、自動テスト（tests/data/itemIndex.test.ts）でも検査される。

索引の形式（設問IDの一覧。複数の設問を持つ出題単位は、設問IDの配列）:
  words / grammar / listeningPart1 / listeningPart2 : [設問ID, ...]
  listeningPart34 / part6 / readings                : [[設問ID, ...], ...]  （会話・文書ごと）
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"


def load(name):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def build():
    return {
        "words": [w["id"] for w in load("words")],
        "grammar": [g["id"] for g in load("grammar")],
        "listeningPart1": [x["id"] for x in load("listeningPart1")],
        "listeningPart2": [x["id"] for x in load("listeningPart2")],
        "listeningPart34": [[q["id"] for q in s["questions"]] for s in load("listeningPart34")],
        "part6": [[b["id"] for b in p["blanks"]] for p in load("part6")],
        "readings": [[q["id"] for q in p["questions"]] for p in load("readings")],
    }


def serialize(index):
    # 小さく保つため、空白なしの1行で書き出す
    return json.dumps(index, ensure_ascii=False, separators=(",", ":"))


def build_grammar_categories():
    return {g["id"]: g["category"] for g in load("grammar")}


def main():
    path = DATA / "itemIndex.json"
    cat_path = DATA / "grammarCategories.json"
    expected = serialize(build())
    expected_cat = serialize(build_grammar_categories())
    if "--check" in sys.argv:
        actual = path.read_text(encoding="utf-8") if path.exists() else None
        actual_cat = cat_path.read_text(encoding="utf-8") if cat_path.exists() else None
        if actual == expected and actual_cat == expected_cat:
            print("索引は問題データと一致しています")
            sys.exit(0)
        print("索引が問題データと一致していません。python3 tools/build_item_index.py を実行してください")
        sys.exit(1)
    cat_path.write_text(expected_cat, encoding="utf-8")
    print(f"文法カテゴリの対応を書き出しました: {cat_path.name} （{len(expected_cat) / 1000:.0f}KB）")
    path.write_text(expected, encoding="utf-8")
    index = json.loads(expected)
    n = sum(len(v) if not v or not isinstance(v[0], list) else sum(len(x) for x in v) for v in index.values())
    print(f"索引を書き出しました: {path.name} （設問ID {n}件、{len(expected) / 1000:.0f}KB）")


if __name__ == "__main__":
    main()
