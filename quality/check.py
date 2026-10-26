#!/usr/bin/env python3
"""問題データの品質チェック（機械的に検出できるもの）。

  python3 tools/quality/check.py            # 概要を表示し、tools/quality/report.json に全件を書き出す
  python3 tools/quality/check.py --strict   # ERROR が1件でもあれば終了コード1（CI向け）

重大度:
  ERROR … ほぼ確実に不具合（正解と解説の食い違い、選択肢の重複、完成文が合わない など）
  WARN  … 人の目で確認したほうがよいもの（似た問題、例文に単語がない など）
  INFO  … 参考（問題文は同じで正解が違う、など。問題としては成立する）
"""
import json, re, sys, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
import os
DATA = Path(os.environ["QUALITY_DATA"]) if os.environ.get("QUALITY_DATA") else ROOT / "src" / "data"
L = lambda n: json.loads((DATA / f"{n}.json").read_text(encoding="utf-8"))
LET = "ABCD"
issues = []


def add(sev, kind, item_id, msg):
    issues.append({"sev": sev, "kind": kind, "id": item_id, "msg": msg})


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", s.lower())).strip()


def answer_in_expl(expl, choices, ans, qid, kind):
    """[正解] (X) 文 が、正解の選択肢と一致するか"""
    m = re.search(r"\[正解\]\s*\(([A-D])\)\s*(.+)", expl or "")
    if not m:
        return
    if LET.index(m.group(1)) != ans:
        add("ERROR", kind, qid, f"解説の正解記号 {m.group(1)} が正解番号 {LET[ans]} と不一致")
    elif norm(m.group(2)) != norm(choices[ans]):
        add("ERROR", kind, qid, f"解説の正解の文が選択肢と不一致: {m.group(2)!r} / {choices[ans]!r}")


def structural(qs, kind, n_choices):
    for q in qs:
        ch, a, qid = q["choices"], q["answer"], q["id"]
        if len(ch) != n_choices:
            add("ERROR", kind, qid, f"選択肢が{len(ch)}個（{n_choices}個のはず）")
        if not (0 <= a < len(ch)):
            add("ERROR", kind, qid, f"answer={a} が範囲外")
            continue
        if len({c.strip().lower() for c in ch}) != len(ch):
            add("ERROR", kind, qid, "選択肢に重複がある")
        if any(not c.strip() for c in ch):
            add("ERROR", kind, qid, "空の選択肢がある")


# next / last / this の前に in・on・at は置けない（in next fall は非文。by next fall、until next week は正しい）
BAD_TIME_PREP = re.compile(
    r"\b(in|on|at)\s+(next|last|this)\s+(week|month|year|quarter|spring|summer|fall|autumn|winter|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b(?!\s*['’]s)",
    re.I,
)

# ---- 文法 ----
G = L("grammar")
structural(G, "grammar", 4)
for q in G:
    qid, ch, a = q["id"], q["choices"], q["answer"]
    if q["question"].count("___") != 1:
        add("ERROR", "grammar", qid, f"空欄（___）が{q['question'].count('___')}個")
    answer_in_expl(q["explanation"], ch, a, qid, "grammar")
    m = re.search(r"完成文:\s*(.+)", q["explanation"])
    if m and q["question"].count("___") == 1:
        built = q["question"].replace("___", ch[a])
        if norm(built) != norm(m.group(1)):
            add("ERROR", "grammar", qid, f"完成文が問題文＋正解と合わない: {m.group(1)!r} / {built!r}")
    m2 = re.search(r"完成文:\s*(.+)", q["explanation"])
    bad = BAD_TIME_PREP.search(m2.group(1)) if m2 else None
    if bad:
        add("ERROR", "grammar", qid, f"完成文が非文: 「{bad.group(0)}」（next / last / this の前に in・on・at は置かない）")

# ---- Part 1 / Part 2 ----
P1, P2 = L("listeningPart1"), L("listeningPart2")
structural(P1, "part1", 4)
structural(P2, "part2", 3)
for q in P1:
    answer_in_expl(q["explanation"], q["choices"], q["answer"], q["id"], "part1")
for q in P2:
    answer_in_expl(q["explanation"], q["choices"], q["answer"], q["id"], "part2")

# ---- Part 3/4, Part 6, 読解 ----
P34 = L("listeningPart34")
P6 = L("part6")
RD = L("readings")
qs34 = [q for s in P34 for q in s["questions"]]
qs6 = [b for p in P6 for b in p["blanks"]]
qsrd = [q for p in RD for q in p["questions"]]
structural(qs34, "part34", 4)
structural(qs6, "part6", 4)
structural(qsrd, "reading", 4)

QUOTE = re.compile(r"[「『“\"]([^」』”\"]{2,}?)[」』”\"][^。]{0,12}?(?:が|は|を)?正解")


def detail_check(qs, kind):
    for q in qs:
        d, ja, a = q.get("explanationDetail") or "", q.get("choicesJa"), q["answer"]
        if not d:
            add("WARN", kind, q["id"], "詳細解説がない")
            continue
        if ja:
            m = QUOTE.search(d)
            if m:
                quoted = m.group(1).strip("。 ")
                best = max(range(len(ja)), key=lambda i: (quoted in ja[i] or ja[i] in quoted, -abs(len(ja[i]) - len(quoted))))
                hits = [i for i, j in enumerate(ja) if quoted == j.strip("。 ")]
                if hits and a not in hits:
                    add("ERROR", kind, q["id"], f"解説が正解として挙げた「{quoted}」は、選択肢{LET[hits[0]]}の和訳で、正解は{LET[a]}")


detail_check(qs34, "part34")
detail_check(qs6, "part6")
detail_check(qsrd, "reading")

# Part 6: 空欄の数
for p in P6:
    nums = sorted(set(int(x) for x in re.findall(r"\((\d)\)", p["passage"])))
    if nums != list(range(1, len(p["blanks"]) + 1)):
        add("ERROR", "part6", p["id"], f"本文の空欄番号 {nums} と設問数 {len(p['blanks'])} が合わない")

# ---- 単語 ----
W = L("words")
seen = collections.defaultdict(list)
for w in W:
    seen[norm(w["word"])].append(w["id"])
    if not w.get("meaning", "").strip():
        add("ERROR", "words", w["id"], "意味が空")
    stem = norm(w["word"]).split(" ")[0][:5]
    if stem and stem not in norm(w["example"]).replace(" ", "") and stem not in norm(w["example"]):
        add("WARN", "words", w["id"], f"例文に単語（{w['word']}）またはその変化形が見当たらない")
for k, ids in seen.items():
    if len(ids) > 1:
        add("WARN", "words", ",".join(ids), f"同じ単語が重複: {k}")

# ---- 重複・類似問題 ----
def dupes(items, text_of, kind, thresh=0.85, answer_of=None):
    """問題文が同じものを探す。answer_of を渡すと、正解の選択肢まで同じものを ERROR（完全な重複）、
    問題文だけ同じで正解が違うものを INFO（問題としては成立する）として分ける。"""
    exact = collections.defaultdict(list)
    for it in items:
        exact[norm(text_of(it))].append(it)
    for k, group in exact.items():
        if len(group) < 2 or not k:
            continue
        ids = ",".join(g["id"] for g in group)
        if answer_of is None:
            add("WARN", kind, ids, "同じ文章が複数ある")
            continue
        answers = [norm(answer_of(g)) for g in group]
        if len(set(answers)) < len(answers):
            add("ERROR", kind, ids, "問題文も正解も同じ（完全な重複）")
        else:
            add("INFO", kind, ids, "問題文は同じで、正解が違う（意図した別問題か要確認）")
    toks = [(it["id"], set(norm(text_of(it)).split())) for it in items]
    for i in range(len(toks)):
        for j in range(i + 1, len(toks)):
            a, b = toks[i][1], toks[j][1]
            if len(a) >= 6 and len(b) >= 6:
                sim = len(a & b) / len(a | b)
                if thresh <= sim < 1.0:
                    add("WARN", kind, f"{toks[i][0]},{toks[j][0]}", f"似た問題文（類似度{sim:.2f}）")


dupes(G, lambda q: q["question"], "grammar", answer_of=lambda q: q["choices"][q["answer"]])
dupes(P2, lambda q: q["question"], "part2", answer_of=lambda q: q["choices"][q["answer"]])
# Part 3/4・読解は、「Why is the man calling?」のような一般的な設問文が別の会話・文書で同じになるのが正常なので、
# 設問文だけでは重複を判定しない（会話・文書そのものの重複を下で調べる）
dupes(RD, lambda p: p["passage"], "reading文書", 0.8)
dupes(P34, lambda s: " ".join(x["line"] for x in s["script"]), "part34会話", 0.8)
dupes(P6, lambda p: p["passage"], "part6文書", 0.8)

# ---- 正解が最長の偏り（出題の手がかりになる） ----
def longest_bias(qs, kind):
    n = sum(1 for q in qs if max(q["choices"], key=len) == q["choices"][q["answer"]] and sorted(map(len, q["choices"]))[-1] > sorted(map(len, q["choices"]))[-2])
    return kind, n, len(qs), n / len(qs)


bias = [longest_bias(qs34, "part34"), longest_bias(qs6, "part6"), longest_bias(qsrd, "reading"), longest_bias(G, "grammar"), longest_bias(P2, "part2"), longest_bias(P1, "part1")]

# ---- 出力 ----
out = Path(os.environ["QUALITY_OUT"]) if os.environ.get("QUALITY_OUT") else ROOT / "tools" / "quality" / "report.json"
out.write_text(json.dumps({"issues": issues, "longestAnswerBias": bias}, ensure_ascii=False, indent=1), encoding="utf-8")
by = collections.Counter((i["sev"], i["kind"]) for i in issues)
print("== 件数（重大度, 分野） ==")
for (sev, kind), n in sorted(by.items()):
    print(f"  {sev:5} {kind:10} {n}")
print("== 正解が唯一の最長選択肢になる割合（偏りがなければ約25%、Part 2は約33%） ==")
for kind, n, tot, r in bias:
    print(f"  {kind:8} {n}/{tot} = {r:.1%}")
errs = sum(1 for i in issues if i["sev"] == "ERROR")
info = sum(1 for i in issues if i["sev"] == "INFO")
print(f"ERROR {errs}件 / WARN {len(issues) - errs - info}件 / INFO {info}件  → {out}")
if "--strict" in sys.argv and errs:
    sys.exit(1)
