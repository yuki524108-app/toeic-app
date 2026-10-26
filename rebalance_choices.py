#!/usr/bin/env python3
"""
選択肢の正解位置の偏りをならす。

問題データ（src/data/*.json）は、正解がA（またはB）に偏っていた（例：Part 2 は約86%がA）。
そのままだと「迷ったらA」だけで高得点になってしまうため、正解の位置が選択肢の数に対して
均等になるよう、選択肢を並べ替える。

  python3 tools/rebalance_choices.py          # 並べ替えを適用して src/data/*.json を書き換える
  python3 tools/rebalance_choices.py --check  # 書き換えずに、現在のデータの偏りと整合性を検査する

- 並べ替えの方法：正解の選択肢を目標の位置へ移し、ほかの選択肢の相対的な並び順は保つ。
- 目標位置は、グループ（文法・Part 1・Part 2・Part 3/4・Part 6・読解）ごとに、固定の乱数種から決める。
  同じ入力に対して同じ結果になり、2回実行しても結果は変わらない（冪等）。
- 数値・時刻が昇順に並んだ選択肢（"9 A.M." → "10 A.M." など）は、TOEICの慣例に合わせて並べ替えない。
- 選択肢の和訳（choicesJa）は選択肢と同じ順に並べ替え、詳細解説（explanationDetail）の記号も書き換える。
- 解説に選択肢の記号（(A)・選択肢B など）が書かれている場合は、並べ替えに合わせて記号も書き換える。
  ただし、問題文中の二者択一（"A or B"）を指す記号は書き換えない。
- 生成データを取り込み直した（import_results.py などで src/data を上書きした）あとは、再度このスクリプトを実行する。

並べ替えで選択肢の番号が変わるため、過去の模試の履歴（選んだ選択肢を番号で保存している）は
アプリ側で変換して表示する（src/lib/choiceOrder.ts）。
"""
import json
import random
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
LETTERS = "ABCD"
SEED_VERSION = "v1"


def load(name):
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


def save(name, data):
    # 既存ファイルと同じ整形（indent=2・ensure_ascii=False・末尾改行なし）
    (DATA / f"{name}.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def groups(data):
    """グループ名 → 設問（辞書）のリスト。辞書は元データへの参照なので、書き換えは元データに反映される"""
    return {
        "grammar": list(data["grammar"]),
        "part1": list(data["listeningPart1"]),
        "part2": list(data["listeningPart2"]),
        "part34": [q for s in data["listeningPart34"] for q in s["questions"]],
        "part6": [b for p in data["part6"] for b in p["blanks"]],
        "reading": [q for p in data["readings"] for q in p["questions"]],
    }


def is_ordered(choices):
    """選択肢がすべて数値で始まり、昇順に並んでいる（慣例として並べ替えない）"""
    nums = [re.findall(r"\d[\d,\.]*", c) for c in choices]
    if not all(nums):
        return False
    try:
        values = [float(n[0].replace(",", "")) for n in nums]
    except ValueError:
        return False
    return values == sorted(values) and len(set(values)) == len(values)


def assign_targets(qs, k, rng):
    """各設問の目標の正解位置を決める。固定する設問を除いて、全体が均等になるように割り当てる"""
    n = len(qs)
    movable_idx = [i for i, q in enumerate(qs) if not is_ordered(q["choices"])]
    base, extra = divmod(n, k)
    extra_pos = set(rng.sample(range(k), extra))
    desired = [base + (1 if p in extra_pos else 0) for p in range(k)]
    fixed_counts = [0] * k
    for i, q in enumerate(qs):
        if i not in movable_idx:
            fixed_counts[q["answer"]] += 1
    need = [max(0, desired[p] - fixed_counts[p]) for p in range(k)]
    pool = [p for p in range(k) for _ in range(need[p])]
    while len(pool) < len(movable_idx):  # 足りない分は、最も少ない位置から足す
        p = min(range(k), key=lambda x: (pool.count(x) + fixed_counts[x], rng.random()))
        pool.append(p)
    while len(pool) > len(movable_idx):  # 多い分は、最も多い位置から減らす
        p = max(range(k), key=lambda x: (pool.count(x) + fixed_counts[x], rng.random()))
        pool.remove(p)
    rng.shuffle(pool)
    targets = {}
    for i, t in zip(movable_idx, pool):
        targets[i] = t
    return targets


def position_map(old_answer, new_answer, k):
    """旧い選択肢番号 → 新しい番号。正解を new_answer へ移し、ほかは相対的な順序を保つ"""
    m = {}
    for i in range(k):
        if i == old_answer:
            m[i] = new_answer
        else:
            j = i if i < old_answer else i - 1  # 正解を除いたときの位置
            m[i] = j if j < new_answer else j + 1
    return m


# ---------- 解説の記号の書き換え ----------
HEAD_LETTER = re.compile(r"^\[正解\] \(([A-D])\)", re.M)
LINE_LETTER = re.compile(r"^(\[正解\] )?\(([A-D])\)(?= )", re.M)
PROTECT = re.compile(r"\b([A-D]) or ([A-D])\b")
# 日本語の説明文中で選択肢を指す記号（直後が助詞・句読点・閉じ括弧、または直前が「(」「選択肢」）
PROSE_LETTER = re.compile(r"(?<![A-Za-z\x00])([A-D])(?=[はがをのとにもでや、。\)）」・]|$)")


def remap_grammar(exp, m):
    def sub(mt):
        return f"[正解] ({LETTERS[m[LETTERS.index(mt.group(1))]]})"
    return HEAD_LETTER.sub(sub, exp, count=1)


def remap_part1(exp, m):
    def sub(mt):
        return f"{mt.group(1) or ''}({LETTERS[m[LETTERS.index(mt.group(2))]]})"
    return LINE_LETTER.sub(sub, exp)


def remap_part2(exp, m):
    exp = HEAD_LETTER.sub(
        lambda mt: f"[正解] ({LETTERS[m[LETTERS.index(mt.group(1))]]})", exp, count=1
    )
    seg = re.search(r"\[ポイント\](.*?)(?=\n\n\[重要単語\]|\Z)", exp, re.S)
    if not seg:
        return exp
    text = seg.group(1)
    # 問題文中の二者択一（"A or B"）は保護する
    protected = []
    def mask(mt):
        protected.append(mt.group(0))
        return f"\x00{len(protected) - 1}\x00"
    text = PROTECT.sub(mask, text)
    text = PROSE_LETTER.sub(lambda mt: LETTERS[m[LETTERS.index(mt.group(1))]], text)
    text = re.sub(r"\x00(\d+)\x00", lambda mt: protected[int(mt.group(1))], text)
    return exp[: seg.start(1)] + text + exp[seg.end(1):]


REMAP = {"grammar": remap_grammar, "part1": remap_part1, "part2": remap_part2}


# 読解・Part 6・Part 3/4 の詳細解説（explanationDetail）と選択肢の和訳（choicesJa）も追従させる
DETAIL_SENTAKUSHI = re.compile(r"選択肢([A-D])")
DETAIL_PAREN = re.compile(r"([(（])([A-D])([)）])")
DETAIL_ANSWER = [re.compile(r"選択肢([A-D])[）)]?が正解"), re.compile(r"[(（]([A-D])[)）][^、。]{0,40}が正解")]
DETAIL_ORDINAL = re.compile(r"([（(])([1-4])番目([）)])(?=が正解)")  # 「（2番目）が正解」＝選択肢の位置


def remap_detail(text, m):
    f = lambda c: LETTERS[m[LETTERS.index(c)]] if LETTERS.index(c) in m else c
    text = DETAIL_SENTAKUSHI.sub(lambda mt: "選択肢" + f(mt.group(1)), text)
    text = DETAIL_PAREN.sub(lambda mt: mt.group(1) + f(mt.group(2)) + mt.group(3), text)
    return DETAIL_ORDINAL.sub(lambda mt: f"{mt.group(1)}{m[int(mt.group(2)) - 1] + 1}番目{mt.group(3)}", text)


def remap_choices_ja(ja, m, k):
    if not isinstance(ja, list) or len(ja) != k:
        return ja
    out = [None] * k
    for i in range(k):
        out[m[i]] = ja[i]
    return out


def apply(data):
    report = {}
    for name, qs in groups(data).items():
        ks = {len(q["choices"]) for q in qs}
        assert len(ks) == 1, f"{name}: 選択肢の数がそろっていません {ks}"
        k = ks.pop()
        targets = assign_targets(qs, k, random.Random(f"{name}-{SEED_VERSION}"))
        moved = 0
        for i, t in targets.items():
            q = qs[i]
            old = q["answer"]
            correct = q["choices"][old]
            others = [c for j, c in enumerate(q["choices"]) if j != old]
            new_choices = others[:t] + [correct] + others[t:]
            if old != t:
                moved += 1
                pm = position_map(old, t, k)
                if name in REMAP and q.get("explanation"):
                    q["explanation"] = REMAP[name](q["explanation"], pm)
                if q.get("choicesJa"):
                    q["choicesJa"] = remap_choices_ja(q["choicesJa"], pm, k)
                if q.get("explanationDetail"):
                    q["explanationDetail"] = remap_detail(q["explanationDetail"], pm)
            q["choices"] = new_choices
            q["answer"] = t
        report[name] = (len(qs), moved)
    return report


def distribution(qs, k):
    c = [0] * k
    for q in qs:
        c[q["answer"]] += 1
    return c


def check(data):
    """現在のデータの偏りと整合性を検査する。問題があれば False"""
    ok = True
    print("正解位置の分布（件数 / 割合）")
    for name, qs in groups(data).items():
        k = len(qs[0]["choices"])
        c = distribution(qs, k)
        n = len(qs)
        share = "  ".join(f"{LETTERS[p]}:{c[p]:4d}({100 * c[p] / n:4.1f}%)" for p in range(k))
        fixed = sum(1 for q in qs if is_ordered(q["choices"]))
        spread = max(c) - min(c)
        flag = "OK" if spread <= max(2, fixed) else "偏りあり"
        if flag != "OK":
            ok = False
        print(f"  {name:8s} {n:5d}問  {share}   (昇順で固定 {fixed}問) {flag}")
    problems = []
    for name, qs in groups(data).items():
        for q in qs:
            ch = q["choices"]
            qid = q.get("id", "?")
            if not 0 <= q["answer"] < len(ch):
                problems.append(f"{name} {qid}: 正解番号が範囲外")
            if len({c.strip().lower() for c in ch}) != len(ch):
                problems.append(f"{name} {qid}: 選択肢が重複 {ch}")
            exp = q.get("explanation") or ""
            m = HEAD_LETTER.search(exp)
            if name in ("grammar", "part1", "part2"):
                if not m:
                    problems.append(f"{name} {qid}: 解説に [正解] (記号) がない")
                elif LETTERS.index(m.group(1)) != q["answer"]:
                    problems.append(f"{name} {qid}: 解説の正解記号 {m.group(1)} が正解番号 {LETTERS[q['answer']]} と不一致")
            if name == "part1":
                for mt in LINE_LETTER.finditer(exp):
                    idx = LETTERS.index(mt.group(2))
                    line = exp[mt.end():].split("\n", 1)[0].strip()
                    if idx >= len(ch) or line != ch[idx]:
                        problems.append(f"{name} {qid}: 解説の ({mt.group(2)}) の文が選択肢と不一致")
            detail = q.get("explanationDetail") or ""
            for r in DETAIL_ANSWER:
                md = r.search(detail)
                if md and LETTERS.index(md.group(1)) != q["answer"]:
                    problems.append(f"{name} {qid}: 詳細解説の正解記号 {md.group(1)} が正解番号 {LETTERS[q['answer']]} と不一致")
                    break
            mo = DETAIL_ORDINAL.search(detail)
            if mo and int(mo.group(2)) - 1 != q["answer"]:
                problems.append(f"{name} {qid}: 詳細解説の「{mo.group(2)}番目が正解」が正解番号 {q['answer'] + 1} と不一致")
            ja = q.get("choicesJa")
            if ja is not None and len(ja) != len(ch):
                problems.append(f"{name} {qid}: choicesJa の数が選択肢と不一致")
            if name == "part2" and m:
                line = exp[m.end():].split("\n", 1)[0].strip()
                if line != ch[q["answer"]]:
                    problems.append(f"{name} {qid}: 解説の正解の文が選択肢と不一致")
    for p in problems[:30]:
        print("  問題:", p)
    print(f"整合性の問題: {len(problems)}件")
    return ok and not problems


def main():
    names = {
        "grammar": "grammar", "listeningPart1": "listeningPart1", "listeningPart2": "listeningPart2",
        "listeningPart34": "listeningPart34", "part6": "part6", "readings": "readings",
    }
    data = {n: load(n) for n in names}
    if "--check" in sys.argv:
        sys.exit(0 if check(data) else 1)
    report = apply(data)
    for n in names:
        save(n, data[n])
    print("並べ替えた設問数 / 設問数")
    for name, (n, moved) in report.items():
        print(f"  {name:8s} {moved:5d} / {n}")
    print()
    sys.exit(0 if check(data) else 1)


if __name__ == "__main__":
    main()
