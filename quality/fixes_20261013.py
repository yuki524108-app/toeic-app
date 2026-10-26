#!/usr/bin/env python3
"""品質チェック（2026-10-13）で見つかった欠陥の修正。1回限り・再実行しても何も変わらない（元の内容と一致したものだけ直す）。

  python3 tools/quality/fixes_20261013.py [--dry-run]

修正の方針: 正解の位置（answer の番号）は変えない。正解位置の均等配分（rebalance_choices.py）を崩さないため。
"""
import json, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data"
DRY = "--dry-run" in sys.argv
load = lambda n: json.loads((DATA / f"{n}.json").read_text(encoding="utf-8"))
changed = []


def explanation(correct_letter, correct, completed, ja, point, words):
    return (f"[正解] ({correct_letter}) {correct}\n完成文: {completed}\n全訳: {ja}\n\n[ポイント] {point}\n\n[重要単語・表現]\n"
            + "\n".join(f"・{w}" for w in words))


def p2_explanation(question, question_ja, letter, correct, correct_ja, point, words):
    return (f"[質問] {question}\n全訳: {question_ja}\n\n[正解] ({letter}) {correct}\n全訳: {correct_ja}\n\n[ポイント] {point}\n\n[重要単語]\n"
            + "\n".join(f"・{w}" for w in words))


# ---------- 文法 ----------
# id: (元の問題文, 新しい内容)  元の問題文が一致するときだけ置き換える
GRAMMAR = {
    # 正解が誤り：「in next spring / in next fall」は非文。期限を表す by を正解にする（正解位置は変えない）
    "g078": ("The company will relocate its headquarters ___ next spring.", dict(
        choices=["in", "until", "on", "by"],
        explanation=explanation("D", "by", "The company will relocate its headquarters by next spring.", "会社は来春までに、本社を移転する予定だ。",
                                "期限（〜までに）を表す by が入ります。next / last / this が付く語の前には in や on を置かないので、in next spring は誤りです。until は「〜までずっと」という継続を表すため、移転のような一度きりの動作には合いません。",
                                ["relocate：移転する", "headquarters：本社", "by：〜までに"]))),
    "g250": ("The company will launch its new app ___ next fall.", dict(
        choices=["in", "until", "by", "on"],
        explanation=explanation("C", "by", "The company will launch its new app by next fall.", "会社は次の秋までに、新しいアプリを公開する予定だ。",
                                "期限（〜までに）を表す by が入ります。next / last / this が付く語の前には in や on を置かないので、in next fall は誤りです。until は「〜までずっと」という継続を表すため、公開のような一度きりの動作には合いません。",
                                ["launch：公開する", "fall：秋", "by：〜までに"]))),
    # 正解が誤り：need not have to は非文
    "g764": ("You ___ not have to attend the meeting if you're busy.", dict(
        question="You do ___ have to attend the meeting if you're busy.",
        choices=["no", "neither", "never", "not"],
        explanation=explanation("D", "not", "You do not have to attend the meeting if you're busy.", "忙しいなら、会議に出席する必要はありません。",
                                "do not have to は「〜する必要はない」という意味です。have to の否定は do not を使って作ります。must not は「〜してはいけない」という禁止になり、意味が大きく変わるので注意しましょう。",
                                ["do not have to：〜する必要はない", "attend：出席する"]))),
    # 複数の選択肢が正解になりうる → 余分な正解候補を、明らかな誤りに差し替える
    "g982": ("The consultant's insights proved invaluable ___ the decision-making process.", dict(
        choices=["of", "at", "with", "for"])),
    "g729": ("The report contains ___ useful data for decision-making.", dict(
        question="The report contains ___ useful information for decision-making.",
        choices=["a little", "many", "several", "a few"],
        explanation=explanation("A", "a little", "The report contains a little useful information for decision-making.", "その報告書には、意思決定に役立つ情報が少しある。",
                                "information は数えられない名詞（不可算名詞）なので、a little（少しある）が入ります。many・several・a few は数えられる名詞の複数形につく語です。",
                                ["a little：少しある", "information：情報", "decision-making：意思決定"]))),
    # 完全な重複・曖昧な問題 → 新しい問題に差し替える（ID・カテゴリ・難易度・正解位置はそのまま）
    "g219": ("The consultant suggested ___ the marketing budget.", dict(
        question="The director avoided ___ the budget cuts during the meeting.",
        choices=["mention", "to mention", "mentioned", "mentioning"],
        explanation=explanation("D", "mentioning", "The director avoided mentioning the budget cuts during the meeting.", "部長は会議中、予算削減に触れるのを避けた。",
                                "avoid は動名詞（-ing）を目的語にとる動詞です。to 不定詞や原形は続けられません。",
                                ["avoid：避ける", "mention：言及する", "budget cut：予算削減"]))),
    "g884": ("The number of applicants ___ increased significantly this year.", dict(
        question="Each of the new employees ___ required to attend the orientation.",
        choices=["is", "are", "were", "have been"],
        explanation=explanation("A", "is", "Each of the new employees is required to attend the orientation.", "新入社員の一人ひとりが、オリエンテーションへの出席を求められている。",
                                "Each of ～ は「～のそれぞれ」で、単数扱いです。動詞は単数形の is を使います。複数形の are・were・have been は合いません。",
                                ["each of：～のそれぞれ", "required：求められている", "orientation：オリエンテーション"]))),
    "g717": ("The report stated that sales ___ increased significantly.", dict(
        question="By the end of this year, the company ___ its fifth overseas office.",
        choices=["opened", "will have opened", "opens", "has opened"],
        explanation=explanation("B", "will have opened", "By the end of this year, the company will have opened its fifth overseas office.", "今年の終わりまでに、会社は5つ目の海外オフィスを開設しているだろう。",
                                "By the end of this year（今年の終わりまでに）は未来のある時点までの完了を表すので、未来完了形 will have + 過去分詞 を使います。過去形・現在形・現在完了形は未来の時点には合いません。",
                                ["by the end of：～の終わりまでに", "overseas：海外の", "office：事務所"]))),
    "g524": None,  # 下のg883を参照（g524は残す）
    "g883": ("A number of employees ___ requested flexible working hours.", dict(
        question="The manager, along with her assistants, ___ attending the conference.",
        choices=["are", "is", "were", "have been"],
        explanation=explanation("B", "is", "The manager, along with her assistants, is attending the conference.", "部長は、アシスタントたちとともに、会議に出席します。",
                                "動詞の形は主語の The manager（単数）に合わせます。along with her assistants は挿入句で、主語の数には影響しません。そのため単数形の is が入ります。",
                                ["along with：～と一緒に", "assistant：アシスタント", "attend：出席する"]))),
    "g553": ("___ information you provided was very helpful.", dict(
        question="We received ___ applications for the position this year.",
        choices=["much", "a lot of", "a little", "an"],
        explanation=explanation("B", "a lot of", "We received a lot of applications for the position this year.", "今年、その職には多数の応募があった。",
                                "applications は数えられる名詞の複数形です。a lot of は数えられる名詞にも数えられない名詞にも使えます。much・a little は数えられない名詞用、an は単数名詞用なので合いません。",
                                ["a lot of：多くの", "application：応募", "position：職、ポスト"]))),
    "g621": ("Of all the candidates, she was ___ qualified.", dict(
        question="The new printer is ___ reliable than the old one.",
        choices=["most", "more", "very", "much"],
        explanation=explanation("B", "more", "The new printer is more reliable than the old one.", "新しいプリンターは、古いものより信頼性が高い。",
                                "than（～より）があるので、比較級 more + 形容詞 を使います。most は最上級、very は than と一緒に使えません。much は more を強めるときに使い、単独では比較級を作れません。",
                                ["reliable：信頼できる", "than：～より", "old：古い"]))),
}
GRAMMAR.pop("g524")

# ---------- Part 2（同じ問題・同じ正解の重複を、新しい問題に差し替える）----------
PART2 = {
    "l2097": ("What time does the shuttle bus leave for the airport?", dict(
        question="Where can I pick up my visitor badge?",
        choices=["At the front desk by the entrance.", "It expires at the end of the day.", "Yes, I met him yesterday."],
        explanation=p2_explanation("Where can I pick up my visitor badge?", "訪問者用バッジはどこで受け取れますか。", "A",
                                   "At the front desk by the entrance.", "入口のそばの受付です。",
                                   "Where（どこで）の質問には場所で答えます。選択肢Bは期限、Cは Yes で始まっており、Where の質問には合いません。",
                                   ["pick up：受け取る", "visitor badge：訪問者用バッジ", "front desk：受付", "entrance：入口"]))),
    "l2251": ("What time does the shuttle bus leave for the airport?", dict(
        question="How often does the maintenance crew inspect the elevators?",
        choices=["Once a month, I believe.", "On the third floor.", "Yes, they are very fast."],
        explanation=p2_explanation("How often does the maintenance crew inspect the elevators?", "保守作業員はどのくらいの頻度でエレベーターを点検しますか。", "A",
                                   "Once a month, I believe.", "月に1回だったと思います。",
                                   "How often（どのくらいの頻度で）の質問には頻度で答えます。選択肢Bは場所、Cは Yes で始まっており、How often の質問には合いません。",
                                   ["maintenance crew：保守作業員", "inspect：点検する", "elevator：エレベーター", "once a month：月に1回"]))),
    "l2304": ("Why don't we take a short break before continuing?", dict(
        question="Shall we review the budget figures before lunch?",
        choices=["I had lunch with the budget team.", "The figures were printed in color.", "Sure, I have time until noon."],
        explanation=p2_explanation("Shall we review the budget figures before lunch?", "昼食の前に予算の数字を確認しましょうか。", "C",
                                   "Sure, I have time until noon.", "ええ、正午まで時間があります。",
                                   "Shall we ～?（～しましょうか）は提案する表現で、承諾の返事が合います。選択肢Aは過去に昼食をとった話、Bは印刷の話で、提案への返事になっていません。",
                                   ["review：確認する", "budget figures：予算の数字", "until noon：正午まで"]))),
    "l2142": ("Could you double-check these numbers before I send them?", dict(
        question="Would you mind sending me the updated schedule?",
        choices=["It starts at nine o'clock.", "The meeting room is upstairs.", "Not at all, I'll send it right away."],
        explanation=p2_explanation("Would you mind sending me the updated schedule?", "更新したスケジュールを送っていただけませんか。", "C",
                                   "Not at all, I'll send it right away.", "かまいませんよ、すぐに送ります。",
                                   "Would you mind ～ing?（～していただけませんか）への承諾は Not at all（かまいません）で答えます。選択肢Aは開始時刻、Bは場所の話で、依頼への返事になっていません。",
                                   ["would you mind ～ing?：～していただけませんか", "updated：更新された", "schedule：スケジュール", "right away：すぐに"]))),
}

# ---------- Part 6 ----------
def fix_part6(data):
    for p in data:
        for b in p["blanks"]:
            if b["id"] == "p690b2" and b["choices"] == ["one-times", "onetime", "one-timed", "one-time"]:
                b["choices"] = ["one-times", "one-timed", "once-time", "one-time"]
                b["choicesJa"] = ["「1回」の複数形（誤用）", "一回限りの（誤用）", "一度の（誤用）", "一回限りの（形容詞）"]
                b["explanationDetail"] = ("名詞 bonus を修飾し、「一回限りの」という意味を表す複合形容詞 one-time が正解です。"
                                          "one-times や one-timed のように語尾を変えることはできず、once-time という語もありません。")
                changed.append("p690b2")


def apply(data, table, text_key="question", name=""):
    for x in data:
        spec = table.get(x["id"])
        if spec is None:
            continue
        old_q, new = spec
        if all(x.get(k) == v for k, v in new.items()):
            continue  # すでに修正済み
        if x[text_key] != old_q:
            continue  # 元の内容と違う（別の変更が入っている）ので触らない
        x.update(new)
        changed.append(x["id"])


def main():
    G, P2, P6 = load("grammar"), load("listeningPart2"), load("part6")
    apply(G, GRAMMAR)
    apply(P2, PART2)
    fix_part6(P6)
    print(f"修正 {len(changed)}件: {' '.join(changed)}")
    if DRY:
        print("(dry-run: 書き込みなし)")
        return
    for name, d in (("grammar", G), ("listeningPart2", P2), ("part6", P6)):
        (DATA / f"{name}.json").write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
