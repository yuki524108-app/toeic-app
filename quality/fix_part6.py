#!/usr/bin/env python3
"""Part 6：500空欄を答えを伏せて解き直して見つけた不具合の是正（2026-10-15）。

見つかった不具合は、次の3種類。
  A. 登録された正解が文法的に誤り（例：has became、the doors opens、no less than five minutes）。
     解説（explanationDetail）のほうが正しい答えを述べていた。→ 正しい語が正解になるよう、選択肢の並びを入れ替える。
  B. 正解以外にも成り立つ選択肢がある（例：essential to / for、by / before）。→ 成り立つ誤答を、成り立たない語に差し替える。
  C. 本文の不備（どの選択肢も入らない空欄、文意が通らない空欄）。→ 本文を最小限に直す（和訳も直す）。
正解の位置（A〜D）は、すべて元のまま変えない（選択肢の並び替えは、位置が変わらないように行う）。
何度実行しても結果は同じ（冪等）。

  python3 tools/quality/fix_part6.py [--dry-run]
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "src" / "data" / "part6.json"

# 空欄ID → 新しい内容。old は、直す前の選択肢（想定と違えば何もしない）。
# ans は新しい選択肢での正解の位置（＝元の位置のまま）。exp/dt は None なら変えない。
B = {}


def fix(bid, old, new, ja, ans, exp=None, dt=None):
    B[bid] = dict(old=old, new=new, ja=ja, ans=ans, exp=exp, dt=dt)


# ---- A. 登録された正解が誤り ----
fix("p625b3", ["are", "were", "was", "is"], ["were", "are", "was", "is"],
    ["〜であった（複数過去）", "〜である（複数現在）", "〜であった（単数過去）", "〜である（単数現在）"], 0,
    exp="主語 items は複数で、previously（以前は）とあるので、過去形の were が正解です。")
fix("p625b4", ["open", "opened", "opening", "opens"], ["opens", "opened", "opening", "open"],
    ["開く（三人称単数現在）", "開いた（過去形）", "開いている（現在分詞/動名詞）", "開く（原形/複数現在）"], 3,
    exp="before 節の中は、未来のことでも現在形を使います。主語 the doors は複数なので open が正解です。")
fix("p629b3", ["more", "less", "much", "many"], ["less", "more", "much", "many"],
    ["より少なく", "より多く（no more than で〜以内）", "多くの", "たくさんの"], 1)
fix("p656b3", ["require", "required", "requires", "requiring"], ["requires", "required", "require", "requiring"],
    ["必要とする（三人称単数現在形）", "必要とした（過去形/過去分詞）", "必要とする（複数形/原形）", "必要としている（現在分詞）"], 2,
    exp="関係代名詞 that の先行詞は複数形の areas なので、動詞も複数に対応した原形 require が正解です。")
fix("p659b3", ["became", "become", "becoming", "becomes"], ["become", "became", "becoming", "becomes"],
    ["〜になる（過去分詞）", "〜になった（過去形）", "〜になりつつある（現在分詞）", "〜になる（三人称単数現在形）"], 0,
    exp="has の後には過去分詞が続きます。become の過去分詞は become なので、has become（現在完了形）が正解です。")
fix("p665b3", ["serves", "serve", "served", "serving"], ["served", "serve", "serves", "serving"],
    ["提供された（過去分詞）", "提供する/もてなす（原形）", "提供する（三人称単数現在）", "提供している（動名詞/現在分詞）"], 0)
fix("p666b3", ["free", "of", "without", "with"], ["free", "without", "of", "with"],
    ["無料の（形容詞）", "〜なしで（前置詞）", "〜の（前置詞）", "〜と共に（前置詞）"], 1,
    exp="rides will be offered without charge で「無料で提供される」という意味になります。",
    dt="空欄の後ろは charge だけなので、「無料で」を表す without charge が正解です。free を使うなら free of charge と of が必要で、of や with ではこの意味になりません。")
fix("p679b3", ["along", "together", "alongside", "with"], ["alongside", "both", "along", "with"],
    ["〜と並んで（前置詞）", "両方（代名詞）", "〜に加えて（副詞 along with）", "〜と一緒に（前置詞）"], 2,
    exp="along with 〜 で「〜に加えて、〜と一緒に」という意味になります。",
    dt="空欄の後ろに with があるので、along with ~（〜に加えて）の形を作る along が正解です。alongside は後ろに with をとらず、both や with だけでは「〜に加えて」の意味になりません。")
fix("p683b3", ["purchase", "purchased", "purchasing", "purchases"], ["purchased", "purchase", "purchasing", "purchases"],
    ["購入された（過去分詞）", "購入する（原形）", "購入している（現在分詞/動名詞）", "購入する（三人称単数現在）/ 購入品（名詞）"], 0,
    exp="can be purchased の受動態になるので、過去分詞 purchased が正解です。")
fix("p692b4", ["many", "much", "most", "more"], ["more", "much", "most", "many"],
    ["より多くの（比較級）", "多くの量（代名詞）", "最も多くの（最上級）", "多くのもの（代名詞）"], 3,
    exp="the first of many で「多くのうちの最初」という意味になります。")
fix("p701b3", ["directly", "direct", "direction", "directed"], ["direct", "directly", "direction", "directed"],
    ["直接の（形容詞）", "直接的に（副詞）", "方向（名詞）", "指示された（過去分詞）"], 0,
    exp="direct deposit は「口座振込（直接入金）」を表す複合名詞です。deposit を修飾する形容詞 direct が正解です。")
fix("p706b3", ["previously", "prior", "priority", "preview"], ["prior", "previously", "priority", "preview"],
    ["以前の・過去の（形容詞）", "以前に（副詞）", "優先事項（名詞）", "下書き・下見（名詞/動詞）"], 0,
    exp="名詞 patients を修飾する形容詞 prior（以前の）が正解です。副詞 previously は名詞を直接修飾できません。")
fix("p715b1", ["conducted", "conducting", "conducts", "conduct"], ["conducted", "conduct", "conducts", "conducting"],
    ["実施された（過去分詞）", "実施する（原形）", "実施する（三人称単数現在形）", "実施している（現在分詞/動名詞）"], 3,
    exp="are の後なので、現在進行形 are conducting（実施している）が正解です。")

# ---- A'. 正解の語は合っているが、解説が食い違っていた／どの選択肢も入らなかった ----
fix("p623b4", ["which", "whose", "who", "what"], ["whose", "what", "which", "whom"],
    ["誰の（所有格関係代名詞）", "何（関係代名詞）", "それ（関係代名詞・物/組織）", "誰を（目的格関係代名詞）"], 2,
    exp="先行詞 our support team（組織・集団）を継続用法で受ける関係代名詞 which が正解です。",
    dt="先行詞 our support team（組織・集団）を、カンマを伴う継続用法で修飾し、続く is の主語になる関係代名詞 which が正解です。whose は所有格、whom は目的格、what は先行詞をとれないため入りません。")
fix("p664b3", ["have", "has", "having", "be"], ["having", "has", "being", "be"],
    ["持っている（現在分詞）", "持つ（三人称単数現在）", "〜されている（現在分詞 being）", "〜される（原形）"], 3,
    exp="助動詞 will の後には動詞の原形が続きます。restarted と組んで受動態 will be restarted を作る be が正解です。",
    dt="助動詞 will の直後には動詞の原形が続きます。過去分詞 restarted と組んで受動態 will be restarted（再起動される）を作る be が正解です。having と being は原形ではなく、has は三人称単数現在形なので、will の後に置けません。")

# ---- B. 正解以外にも成り立つ選択肢があった ----
fix("p602b2", ["willing", "will", "able", "ability"], ["willing", "will", "ably", "ability"],
    ["〜する気がある（形容詞）", "〜だろう（助動詞）", "巧みに（副詞）", "能力（名詞）"], 0)
fix("p624b2", ["a", "the", "one", "per"], ["an", "the", "one", "per"],
    ["（不定冠詞 an：母音の前で使う）", "その（定冠詞）", "1つの（数詞）", "〜につき（前置詞）"], 3,
    dt="「週に3日」という頻度を表す three days per week を作る前置詞 per が正解です。an は母音で始まる語の前に使う冠詞なので week の前には置けず、the や one では「〜につき」の意味になりません。")
fix("p629b1", ["to", "for", "in", "of"], ["with", "for", "on", "of"],
    ["〜と（前置詞）", "〜のために（前置詞）", "〜の上に（前置詞）", "〜の（前置詞）"], 1,
    dt="be essential for ~ing で「〜するために不可欠である」という意味になるので、for が正解です。with・on・of は essential の後ろでこの意味になりません。")
fix("p653b3", ["to", "for", "in", "of"], ["with", "for", "on", "of"],
    ["〜と（前置詞）", "〜のために（前置詞）", "〜の上に（前置詞）", "〜の（前置詞）"], 1,
    dt="be essential for ~ing で「〜するために不可欠である」という意味になるので、for が正解です。with・on・of は essential の後ろでこの意味になりません。")
fix("p631b3", ["over", "above", "up", "on"], ["over", "to", "up", "on"],
    ["～を超えて（前置詞）", "～へ（前置詞）", "上に（副詞）", "～の上に（前置詞）"], 0,
    dt="「この基準を超える金額の申請」という意味を作る前置詞 over が正解です。to・up・on では、基準を超える意味になりません。")
fix("p631b4", ["while", "during", "for", "when"], ["whereas", "during", "for", "when"],
    ["～である一方（接続詞）", "～の間（前置詞）", "～のために（前置詞）", "～する際（接続詞）"], 3)
fix("p645b4", ["must", "shall", "can", "will"], ["must", "shall", "can", "ought"],
    ["～しなければならない（助動詞）", "～するものとする（助動詞）", "～できる／～することがある（助動詞）", "～すべきだ（助動詞 ought to）"], 2,
    dt="アドバイスの実践により「〜することが可能である／〜という効果があり得る」という可能性・能力を表す助動詞 can が最も自然です。ought は to を伴うので、動詞原形の前に単独では置けません。")
fix("p646b4", ["kindly", "please", "would", "shall"], ["kind", "please", "would", "shall"],
    ["親切な（形容詞）", "どうぞ〜してください（副詞）", "〜でしょう（助動詞）", "〜しましょうか（助動詞）"], 1)
fix("p648b2", ["while", "even though", "unless", "as long as"], ["as soon as", "even though", "unless", "while"],
    ["〜するとすぐに（接続詞）", "〜にもかかわらず（接続詞）", "〜でない限り（接続詞）", "〜の間（接続詞）"], 3,
    exp="while supplies last は「在庫がある間（なくなり次第終了）」を表す定型表現です。",
    dt="while supplies last は「在庫がある限り（なくなり次第終了）」を表す商業上の定型表現なので、while が正解です。as soon as は「〜するとすぐに」、even though は譲歩、unless は否定の条件で、いずれも意味が合いません。")
fix("p632b4", ["who", "which", "whom", "whose"], ["what", "which", "whom", "whose"],
    ["何（関係代名詞/疑問詞）", "～であるところの（関係代名詞・非制限・物）", "～を（関係代名詞・目的格）", "～の（関係代名詞・所有格）"], 1,
    exp="先行詞 technical support（部署・サービス）を継続用法で受ける関係代名詞 which が正解です。",
    dt="先行詞 technical support（部署・サービス）を、カンマを伴う継続用法で受け、続く will be の主語になる関係代名詞 which が正解です。what は先行詞をとれず、whom は目的格、whose は所有格なので、主語の位置に入りません。")
fix("p654b2", ["to", "for", "with", "at"], ["on", "for", "with", "at"],
    ["〜について（前置詞）", "〜のために（前置詞）", "〜と（前置詞）", "〜で（前置詞）"], 2,
    dt="speak with ... で「〜と話す」という標準的なフレーズになるので、with が正解です。on・for・at では、speak directly の後ろで「〜と話す」という意味になりません。")
fix("p655b3", ["must", "shall", "will", "can"], ["must", "shall", "ought", "can"],
    ["〜しなければならない（助動詞）", "〜するものとする（助動詞）", "〜すべきだ（助動詞 ought to）", "〜できるように（助動詞）"], 3,
    exp="so (that) they can be addressed で「〜できるように」という目的を表すので、can が正解です。",
    dt="so (that) + 主語 + can ... の形で「〜が…できるように」という目的節を作る can が正解です。must や shall は目的節の意味に合わず、ought は to を伴うので単独では置けません。")
fix("p657b4", ["of", "for", "on", "about"], ["of", "for", "at", "about"],
    ["〜の（前置詞）", "〜のために（前置詞）", "〜で（前置詞）", "〜について（前置詞）"], 3)
fix("p685b4", ["interrupt", "interrupted", "interruption", "interruptions"], ["interrupt", "interrupted", "interrupting", "interruptions"],
    ["中断させる（原形）", "中断された（過去分詞）", "中断させている（現在分詞）", "中断（名詞複数形）"], 3)
fix("p690b4", ["with", "at", "in", "by"], ["with", "to", "on", "by"],
    ["〜に在籍して（前置詞）", "〜へ（前置詞）", "〜の上に（前置詞）", "〜によって（前置詞）"], 0)
fix("p691b4", ["mandate", "mandatory", "mandated", "mandating"], ["mandate", "mandatory", "mandatorily", "mandating"],
    ["命じる（原形）", "義務的な（形容詞）", "義務的に（副詞）", "命じている（現在分詞/動名詞）"], 1)
fix("p696b3", ["accept", "accepted", "acceptable", "acceptance"], ["accept", "accepting", "acceptable", "acceptance"],
    ["受け入れる（原形）", "受け入れている（現在分詞）", "受け入れ可能な（形容詞）", "受領（名詞）"], 2)
fix("p699b4", ["complete", "completing", "completed", "completion"], ["completes", "completing", "completed", "completion"],
    ["完了する（三人称単数現在）", "完了している（現在分詞/動名詞）", "完了した（過去分詞）", "完了（名詞）"], 2)
fix("p711b4", ["before", "after", "by", "during"], ["beyond", "after", "by", "during"],
    ["〜を超えて（前置詞）", "〜の後に（前置詞）", "〜までに（前置詞）", "〜の間（前置詞）"], 2,
    dt="期限を表し「11月5日までに」という意味を作る前置詞 by が正解です。beyond（〜を超えて）、after（〜の後）、during（〜の期間中）では、期限の意味になりません。")
fix("p714b2", ["teacher", "teach", "teaching", "taught"], ["teaching", "teach", "teaches", "taught"],
    ["指導の・教職の（現在分詞/名詞）", "教える（原形）", "教える（三人称単数現在）", "教えた（過去形/過去分詞）"], 0,
    exp="a relevant degree or teaching certification で「関連する学位または指導資格」という名詞句です。")
fix("p715b4", ["before", "until", "since", "by"], ["beyond", "until", "since", "by"],
    ["〜を超えて（前置詞）", "〜までずっと（接続詞/前置詞）", "〜以来（前置詞/接続詞）", "〜までに（前置詞）"], 3,
    dt="提出の期限を表し「今週の金曜日までに」という意味を作る前置詞 by が正解です。until は「〜まで継続して」、beyond は「〜を超えて」、since は「〜以来」で、期限の意味になりません。")
fix("p716b3", ["continue", "continued", "continuous", "continuing"], ["continue", "continually", "continued", "continuance"],
    ["継続する（原形）", "絶えず（副詞）", "継続的な（過去分詞/形容詞）", "継続（名詞）"], 2,
    exp="their continued commitment で「継続的な取り組み」を表す形容詞的な過去分詞 continued が正解です。")

# ---- 本文の不備（本文と和訳を直す。それに合わせた選択肢の直しも含む） ----
fix("p608b1", ["feature", "featured", "features", "featuring"], ["feature", "featured", "features", "featuring"],
    ["特徴づける（原形）", "特徴を備えた（過去分詞）", "特徴づける（三人称単数現在）", "特徴としている（現在分詞/動名詞）"], 3,
    dt="カンマの後ろで、直後の目的語 an intuitive touch-screen interface ... をとって coffee maker を説明する分詞構文を作る現在分詞 featuring が正解です。featured は過去分詞で目的語を直接とれず、feature・features は主節の動詞が別にあるため入りません。")
fix("p620b4", ["instead", "either", "otherwise", "unless"], ["unless", "either", "otherwise", "instead"],
    ["〜でない限り（接続詞）", "〜もまた/どちらか（副詞/代名詞）", "さもなければ/そうでなければ（副詞）", "代わりに（副詞）"], 0,
    exp="「〜しない限り」を表す接続詞 unless が、後ろの節 they reschedule ... を導きます。",
    dt="空欄の後ろには they reschedule という節が続くため、節を導ける接続詞 unless が正解です。otherwise と instead は副詞で節を直接つなげられず、either にも接続の働きがありません。「同じ週に予約を取り直さない限り、来年まで待つ」という意味になります。")
fix("p650b1", ["unless", "although", "so that", "because"], ["although", "unless", "so that", "because"],
    ["〜だけれども（接続詞）", "〜でない限り（接続詞）", "〜するように（接続詞）", "〜だから（接続詞）"], 0,
    exp="譲歩を表す接続詞 although が正解です。「まだ発送されていなくても手数料がかかる」という意味になります。",
    dt="「この時間を過ぎると、注文がまだ発送されていなくても手数料が適用される」という譲歩の関係なので although が正解です。unless は否定の条件で not と二重否定になり、so that は目的、because は理由を表すため、意味が合いません。")
fix("p698b3", ["difficult", "difficulty", "difficulties", "difficultly"], ["difficult", "difficulty", "difficulties", "difficultly"],
    ["難しい（形容詞）", "困難・難しさ（不可算名詞）", "困難（名詞複数形）", "難しく（副詞）"], 2,
    exp="several difficulties で「いくつかの困りごと」という複数名詞です。",
    dt="several は複数名詞を修飾するので、複数形の difficulties が正解です。単数の difficulty は several の後に置けず、形容詞 difficult や副詞 difficultly は名詞の位置に入りません。")
fix("p707b3", ["difficult", "difficulties", "difficulty", "difficultly"], ["difficult", "difficulties", "difficulty", "difficultly"],
    ["難しい（形容詞）", "困難（名詞複数形）", "困難・苦労（不可算名詞）", "難しく（副詞）"], 1,
    exp="several difficulties で「いくつかの困りごと」という複数名詞です。",
    dt="several は複数名詞を修飾するので、複数形の difficulties が正解です。単数の difficulty は several の後に置けず、形容詞 difficult や副詞 difficultly は目的語になれません。")
fix("p714b4", ["freely", "freedom", "frees", "free"], ["freely", "freedom", "frees", "free"],
    ["自由に（副詞）", "自由（名詞）", "解放する（三人称単数現在形）", "無料の（形容詞）"], 3)

# 本文（passage）と和訳（passageJa）の直し：文書ID → [(英語の元, 英語の新, 和訳の元, 和訳の新), ...]
P = {
    "p608": [("coffee maker, (1) with an intuitive", "coffee maker, (1) an intuitive", None, None)],
    "p620": [("may need to (4) wait until next year's cycle.", "may need to wait until next year's cycle (4) they reschedule within the same week.",
              "さもなければ来年の実施期まで待つ必要があるかもしれません。", "同じ週のうちに予約を取り直さない限り、来年の実施期まで待つ必要があるかもしれません。")],
    "p650": [("(1) the order has already shipped.", "(1) the order has not yet shipped.",
              "注文がすでに発送済みでない限り", "注文がまだ発送されていなくても")],
    "p664": [("will (3) restart automatically", "will (3) restarted automatically", None, None)],
    "p698": [("If you have any (3) filling out", "If you have several (3) filling out",
              "新しいテンプレートの記入に関して困難な点がある場合は", "新しいテンプレートの記入に関して、いくつか困難な点がある場合は")],
    "p707": [("If you experience any (3) logging in", "If you experience several (3) logging in",
              "変更後にログインで問題が生じた場合は", "変更後にログインでいくつか問題が生じた場合は")],
    "p714": [("tutoring (4) charge.", "tutoring (4) of charge.", None, None)],
}


def main():
    dry = "--dry-run" in sys.argv
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {p["id"]: p for p in data}
    problems, changed, texts = [], 0, 0

    for pid, edits in P.items():
        p = by[pid]
        for en_old, en_new, ja_old, ja_new in edits:
            if en_new in p["passage"]:
                pass  # 適用済み
            elif p["passage"].count(en_old) == 1:
                p["passage"] = p["passage"].replace(en_old, en_new)
                texts += 1
            else:
                problems.append(f"{pid}: 本文に想定の文が見つからない {en_old!r}")
            if ja_old:
                if ja_new in p["passageJa"]:
                    pass
                elif p["passageJa"].count(ja_old) == 1:
                    p["passageJa"] = p["passageJa"].replace(ja_old, ja_new)
                    texts += 1
                else:
                    problems.append(f"{pid}: 和訳に想定の文が見つからない {ja_old!r}")

    for bid, f in B.items():
        p = by[bid[:4]]
        b = next(x for x in p["blanks"] if x["id"] == bid)
        if b["choices"] == f["new"] and b["answer"] == f["ans"]:
            cur = True
        elif b["choices"] == f["old"]:
            cur = False
        else:
            problems.append(f"{bid}: 想定外の選択肢 {b['choices']}")
            continue
        if len(f["new"]) != 4 or len(f["ja"]) != 4 or len(set(f["new"])) != 4:
            problems.append(f"{bid}: 選択肢の数か重複が不正")
            continue
        before = json.dumps(b, ensure_ascii=False, sort_keys=True)
        b["choices"], b["choicesJa"], b["answer"] = f["new"], f["ja"], f["ans"]
        if f["exp"]:
            b["explanation"] = f["exp"]
        if f["dt"]:
            b["explanationDetail"] = f["dt"]
        if json.dumps(b, ensure_ascii=False, sort_keys=True) != before:
            changed += 1

    for pr in problems:
        print("  問題", pr)
    print(f"空欄 {changed}か所、本文 {texts}か所を修正 / 問題 {len(problems)}件")
    if dry or problems:
        return
    if changed or texts:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
