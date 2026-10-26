#!/usr/bin/env python3
"""文法の全1,000問を解いて見つかった、疑わしい問題の修正（2026-10-14）。1回限り・再実行しても何も変わらない。

  python3 tools/quality/fixes_grammar_20261014.py [--dry-run]

方針: 正解の位置（answer の番号）と、正解の語句は変えない（変える場合は key で明示）。
  * 他の選択肢も正解になりうる問題 → 余分な正解候補を、明らかな誤りに差し替え、解説のポイントを書き直す。
  * 問題文が成り立たない問題 → 問題文を直し、解説を作り直す（q を指定）。
"""
import json, re, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "grammar.json"
DRY = "--dry-run" in sys.argv
LET = "ABCD"


def P(ch, pt):
    return dict(ch=ch, pt=pt)


def F(q, ch, comp, ja, pt, words, key=None):
    return dict(q=q, ch=ch, comp=comp, ja=ja, pt=pt, words=words, key=key)


FIX = {
 # --- 前置詞・接続詞・副詞：余分な正解候補を差し替え ---
 "g959": P(["are", "is", "be", "were"], "feedback は数えられない名詞（不可算名詞）で単数扱いなので、動詞は is を使います。are・were は複数形、be は主語の直後にそのまま置けません。"),
 "g542": P(["by the time", "while", "until", "by"], "「技術者が到着するまでに」という期限を表す接続詞 by the time が入ります。while は「～している間」で意味が合わず、until は継続する動作に使い、by は後ろに節（主語＋動詞）を置けません。"),
 "g054": P(["with", "at", "for", "of"], "予定の変更先の日時を示すときは reschedule for を使います。with・at・of は日時の前に置いて変更先を表せません。"),
 "g226": P(["with", "for", "at", "of"], "予定の変更先の日時を示すときは reschedule for を使います。with・at・of は日時の前に置いて変更先を表せません。"),
 "g131": P(["during", "about", "while", "at"], "during は「～の間」を表し、後ろに名詞（renovation）が続きます。while は後ろに節（主語＋動詞）が必要で、about・at は期間を表せません。"),
 "g146": P(["to", "with", "about", "on"], "congratulate 人 on ～（～を祝う）が決まった形です。to・with・about は congratulate の後で使いません。"),
 "g174": P(["whichever", "whoever", "whatever", "wherever"], "wherever possible（可能な限り、可能な場面では）が決まった言い方です。whichever・whoever・whatever は、ここに入れても文が成り立ちません。"),
 "g271": P(["in", "on", "at", "to"], "特定の日付の前には on を使います。in は月や年、at は時刻や地点に使うので合いません。to は日付の前に置けません。"),
 "g099": P(["in", "at", "on", "to"], "特定の日付の前には on を使います。in は月や年、at は時刻や地点に使うので合いません。to は日付の前に置けません。"),
 "g275": P(["were", "is", "being", "be"], "report は単数名詞で、一般的な性質を述べる文なので現在形の is を使います。were は複数形、being・be は主語の後でそのままでは使えません。"),
 "g305": P(["since", "to", "from", "during"], "「過去5年間からの（データ）」と起点を表すので from を使います。since は since 2020 のような時点に使い、during は期間の中での出来事に使うので合いません。to は data の後で意味が通りません。"),
 "g312": P(["what", "if", "than", "so"], "「もしスケジュールが変わったら」という条件を表す if が入ります。what・than は接続詞として文が成り立たず、so は「だから」の意味で合いません。"),
 "g325": P(["by", "to", "of", "from"], "compile ～ from ...（…から～を編纂する）が決まった形です。by・to・of は data の前で意味が通りません。"),
 "g390": P(["because", "for", "owing", "so as to"], "「～のために」と目的・理由を名詞句で表すので for が入ります。because は後ろに節が必要で、owing は owing to の形でしか使えません。so as to は後ろに動詞の原形が続きます。"),
 "g478": P(["of", "at", "on", "with"], "guidelines on ～（～についてのガイドライン）が決まった形です。of・at・with では意味が通りません。"),
 "g470": P(["since", "by", "for", "within"], "「～以内に」という期限を表すので within が入ります。since は過去の起点、by は by the end of のような形でないと不自然で、for は期間の長さを表すので合いません。"),
 "g038": P(["during", "by", "beyond", "before"], "「確定される前に」という意味なので before が入ります。during・beyond は後ろに名詞が必要で、by は後ろに節を続けて「前に」の意味にはなりません。"),
 "g118": P(["before", "since", "with", "until"], "「署名する前に」という意味なので before が入ります。since・with・until は、後ろに signing it を続けても意味が通りません。"),
 "g204": P(["although", "during", "before", "while"], "「建物に入る前に」という意味なので before が入ります。although は逆接で意味が合わず、during は後ろに名詞が必要、while は同時進行を表すので、サインインの時点には合いません。"),
 "g255": P(["while", "during", "by", "since"], "during は「（特定の期間）の間」を表し、後ろに the holiday season のような名詞が続きます。while は後ろに節が必要で、by・since は期間を表す形になりません。"),
 "g274": P(["at", "for", "to", "on"], "schedule for は「～に予定されている」という決まった言い方です。at・to・on は期間（3月の第3週）の前では合いません。"),
 "g282": P(["in", "over", "out", "down"], "break down は「（交渉などが）決裂する」という決まった言い方です。in・over・out は break の後で意味が通りません。"),
 "g313": P(["to feature", "featuring", "featured", "features"], "文の動詞になるので、単数扱いの headquarters に合わせた features が入ります。to feature は不定詞、featuring・featured は単独では述語になれません。"),
 "g322": P(["with", "for", "by", "of"], "be surprised by ～（～に驚く）が決まった形です。for・of・with は、突然の発表に驚いたことを表せません。"),
 "g323": P(["since", "during", "for", "before"], "「修理を始める前に」という意味なので before が入ります。since・during・for は starting the repair の前では意味が通りません。"),
 "g362": P(["to", "on", "at", "by"], "on time は「時間どおりに」という決まった言い方です。to・at・by では time の前で意味が通りません。"),
 "g374": P(["within prior", "with no prior notice", "having no", "without prior"], "without prior notice は「事前の通知なしに」という決まった言い方です。within prior は意味が通らず、with no prior notice は後ろの notice と重なり、having no は文が成り立ちません。"),
 "g385": P(["by", "over", "at", "since"], "「過去10年にわたって」という期間の経過を表すので over が入ります。by・at は期間の長さを表せず、since は the past decade の前では使えません。"),
 "g389": P(["among", "about", "for", "between"], "「2つの間で選ぶ」ので between が入ります。among は3つ以上のものに使い、about・for は choice の後で意味が通りません。"),
 "g401": P(["at", "by", "on", "for"], "agree on は「～について合意する」という決まった言い方です。at・by・for は agree の後で意味が通りません。"),
 "g420": P(["of", "on", "at", "with"], "instructions on ～（～についての指示）が決まった形です。of・at・with では意味が通りません。"),
 "g486": P(["of", "on", "at", "with"], "feedback on ～（～についてのフィードバック）が決まった形です。of・at・with では意味が通りません。"),
 "g643": P(["since", "by", "into", "until"], "「期限までに」という意味なので by が入ります。since は過去の起点、until は継続する動作の終わりを表すので、提出の期限には合いません。into は the deadline の前で意味が通りません。"),
 "g755": P(["to", "for", "with", "at"], "be skilled at ～ing（～が得意だ）が決まった形です。to・for・with は skilled の後で使いません。"),
 "g758": P(["to", "for", "with", "of"], "apologize for ～（～のことで謝る）が決まった形で、後ろには動名詞が続きます。to・with・of は apologize の後で使いません。"),
 "g806": P(["in", "by", "up", "on"], "on par with は「～と同等」という決まった言い方です。in・by・up は par の前で意味が通りません。"),
 "g815": P(["on", "in", "with", "by"], "on short notice は「急な通知で」という決まった言い方です。in・with・by は notice の前で使いません。"),
 "g831": P(["by", "about", "for", "with"], "be skeptical about は「～に懐疑的である」という決まった言い方です。by・for・with は skeptical の後で意味が通りません。"),
 "g832": P(["by", "for", "about", "with"], "be optimistic about は「～について楽観的である」という決まった言い方です。by・for・with は optimistic の後で意味が通りません。"),
 "g838": P(["in", "by", "at", "with"], "be confident in は「～に自信がある」という決まった言い方です。by・at・with は confident の後で意味が通りません。"),
 # --- 助動詞・時制・文型：余分な正解候補を差し替え ---
 "g606": P(["can't", "mustn't", "haven't", "didn't"], "「彼は会議を欠かさないので、忘れたはずがない」という強い否定の推測を表すので、can't have（～したはずがない）が入ります。mustn't は禁止、haven't・didn't は have の前に置けません。"),
 "g705": P(["repairs", "repaired", "to repair", "repairing"], "see 人 ～ing（人が～しているのを見る）の形で、作業の進行中の様子を表すので repairing が入ります。repairs・repaired・to repair は see の後でこの意味になりません。"),
 "g040": P(["exceed", "is exceeded", "exceeding", "has exceeded"], "for the third year in a row（3年連続で）は、過去から現在まで続く結果を表すので、現在完了形 has exceeded を使います。exceed・exceeding は述語として成り立たず、is exceeded は受け身で意味が合いません。"),
 "g708": P(["presented", "to present", "presents", "present"], "watch 人 ＋ 動詞の原形（人が～するのを見る）の形なので、原形の present が入ります。presented・presents は活用した形、to present は to が余分です。"),
 "g557": P(["A", "An", "Each", "The"], "furniture は数えられない名詞（不可算名詞）で、特定の家具を指すので The が入ります。A・An は単数の可算名詞、Each は単数の可算名詞につきます。"),
 "g038b": None,
 "g514": P(["will have", "have", "having", "had"], "間接疑問文では、時制の一致により、過去より前のことを had + 過去分詞 で表します。will have・have は時制が合わず、having は動詞の形になりません。"),
 "g515": P(["am", "be", "being", "was"], "wondered（過去形）に合わせて、時制の一致で was を使います。am・be・being は主語 the client と合いません。"),
 "g529": P(["has", "doing", "does", "do"], "Rarely が文頭に来ると倒置が起こり、does the CEO speak の形になります。主語が三人称単数なので does です。has・doing・do は倒置の形になりません。"),
 "g556": P(["an", "many", "these", "a"], "report は子音で始まる単数の可算名詞なので、不定冠詞 a が入ります。an は母音で始まる語の前、many・these は複数名詞につきます。"),
 "g560": P(["few", "an", "many", "much"], "difficulty は、ここでは数えられない名詞として使われるので much が入ります。few・many は複数名詞、an は母音で始まる語の前につきます。"),
 "g578": P(["use", "using", "to using", "used"], "try ～ing は「試しに～してみる」という意味で、最初のやり方がうまくいかなかったので別の方法を試す文に合います。use は原形、to using・used は文の形として成り立ちません。"),
 "g609": None,  # 下で個別に定義
 "g615": P(["same", "equally", "identical", "similarly"], "be動詞の後に続く形容詞 identical（同一の）が入ります。same は the が必要、equally・similarly は副詞なので be動詞の後に置けません。"),
 "g143": P(["a little", "little", "a few", "much"], "changes は数えられる名詞の複数形なので a few（いくつかの）が入ります。a little・little・much は数えられない名詞につきます。"),
 "g607": P(["ought", "must", "is", "shall"], "「報告書がないので、間違ったファイルを取ったに違いない」という過去への強い推測を表すので、must have が入ります。ought・shall は have の前でこの意味にならず、is は have と並べられません。"),
 "g674": P(["which", "why", "what", "when"], "reason の後には、理由を表す関係副詞 why が入ります。which・what・when は reason の後でこの文に合いません。"),
 "g690": P(["relocates", "relocating", "will have relocated", "relocated"], "By next year（来年までに）は、未来のある時点までの完了を表すので、未来完了形 will have relocated が入ります。relocates・relocated は時制が合わず、relocating は述語になれません。"),
 "g692": P(["finish", "finishing", "finished", "will have finished"], "by the time the meeting starts（会議が始まるまでに）は、未来のある時点までの完了を表すので、未来完了形 will have finished が入ります。finish・finished・finishing は時制や形が合いません。"),
 "g706": P(["got", "gets", "getting", "get"], "help 人 ＋ 動詞の原形（人が～するのを助ける）の形なので、原形の get が入ります。got・gets は活用した形、getting は help の後でこの形になりません。"),
 "g711": P(["shall", "is", "would", "was"], "asked（過去形）に合わせて、時制の一致で will の過去形 would を使います。shall・is・was は arrive の前に置けないか、時制が合いません。"),
 "g713": P(["shall", "is", "was", "would"], "explained（過去形）に合わせて、時制の一致で will の過去形 would を使います。shall・is・was は take の前に置けないか、時制が合いません。"),
 "g715": P(["would", "shall", "is", "was"], "announced（過去形）に合わせて、時制の一致で will の過去形 would を使います。shall・is・was は expand の前に置けないか、時制が合いません。"),
 "g760": P(["would", "am", "should", "ought"], "「帰る前に提出するべきだ」という義務・推奨を表すので should が入ります。would は意味が合わず、am は主語 You と合いません。ought は後ろに to が必要です。"),
 "g761": P(["ought", "could", "can", "shall"], "「承認できたかもしれない（が、しなかった）」という過去の可能性を表すので could have が入ります。ought は後ろに to が必要で、can・shall は have + 過去分詞の形になりません。"),
 "g763": P(["ought", "would", "can", "shall"], "if it had acted sooner（過去完了）に対する帰結節なので、would have + 過去分詞（仮定法過去完了）が入ります。ought は後ろに to が必要で、can・shall は have + 過去分詞の形になりません。"),
 "g765": P(["may", "ought", "cannot", "am"], "「詳細な予算が含まれていれば承認されるかもしれない」という可能性を表すので may が入ります。ought は後ろに to が必要、cannot は意味が逆になり、am は主語 The proposal と合いません。"),
 "g791": P(["are", "is", "have", "should"], "Under no circumstances（どんな場合でも～ない）が文頭に来ると倒置が起こり、should employees share の形になります。are・is・have は、この倒置の形になりません。"),
 "g799": P(["is", "can", "has", "having"], "Only by working together（協力することによってのみ）が文頭に来ると倒置が起こり、can the team achieve の形になります。is・has・having は後ろに動詞の原形が続く形になりません。"),
 "g840": P(["who", "which", "what", "whom"], "強調構文 It was ～ who ... で、人（the manager）を強調するときは who を使います。which は人には使わず、what は先行詞をとらず、whom は目的格で後ろに主語が必要です。"),
 "g880": P(["provide", "provides", "providing", "to provide"], "主語 report（単数）に合わせて provides が入ります。provide は複数形、providing・to provide は単独では述語になれません。"),
 "g885": P(["been", "was", "be", "being"], "Neither of the proposals は単数扱いで、過去の判断なので was が入ります。been・be・being は単独では述語になれません。"),
 "g887": P(["are", "be", "is", "were"], "equipment は数えられない名詞（不可算名詞）で単数扱いなので、現在形の is が入ります。are・were は複数形、be は主語の直後にそのまま置けません。"),
 "g888": P(["was", "were", "been", "are"], "information は数えられない名詞で単数扱いなので、過去形の was が入ります。were・are は複数形、been は単独では述語になれません。"),
 "g889": P(["were", "been", "are", "was"], "Half of the budget の budget は単数なので、過去形の was が入ります。were・are は複数形、been は単独では述語になれません。"),
 "g890": P(["until", "while", "because", "so"], "「革新的ではあるが」という譲歩を表すので while が入ります。until・because・so は、この挿入句の意味が通りません。"),
 "g899": P(["although", "because", "despite", "so"], "後ろに名詞句 limited resources が続くので、前置詞の despite が入ります。although・because は後ろに節が必要で、so は文が成り立ちません。"),
 "g925": P(["else", "either", "also", "neither"], "「提示された以外にも欠陥がある」という付け足しを表すので also が入ります。else・either・neither は、形容詞 flawed の前に置いてこの意味になりません。"),
 "g928": P(["also", "else", "either", "neither"], "「好意的に受け入れられ、さらに投資家も楽観的だった」という付け足しを表すので also が入ります。else・either・neither は、形容詞 optimistic の前に置いてこの意味になりません。"),
 "g954": P(["having", "has", "is", "be"], "headquarters（本社）は単数扱いで、in the past decade（過去10年間で）があるので、現在完了形 has relocated が入ります。having・be は単独では述語になれず、is は現在形で時制が合いません。"),
 "g970": P(["who", "whether", "what", "which"], "It is doubtful whether ～（～かどうか疑わしい）の形で、whether が入ります。who・what・which は疑問詞で、後ろの節が成り立ちません。"),
 "g974": P(["whom", "what", "which", "how"], "explained how ～（どのように～するかを説明した）の形で、疑問副詞 how が入ります。whom・what・which は、後ろの節（the new regulations would affect the business）が目的語を持つため、合いません。"),
 "g976": P(["are", "is", "be", "were"], "along with ～は主語の数に影響しないので、主語 The manager（単数）に合わせて is が入ります。are・were は複数形、be は主語の直後にそのまま置けません。"),
 "g996": P(["cut", "lose", "absorb", "hold"], "absorb the loss は「損失を吸収する」という決まった言い方です。cut・lose・hold は the loss と一緒に使うと意味が通りません。"),
 "g1000": P(["put", "hold", "keep", "make"], "put the finishing touches on ～は「～に仕上げをする」という決まった言い方です。hold・keep・make は the finishing touches と一緒に使えません。"),
 "g449": P(["to hold steady", "held steady", "holding steady", "holds steady"], "profits（複数）の動作で、過去の出来事を表すので過去形 held steady が入ります。to hold steady は不定詞、holding steady は単独では述語になれず、holds steady は三人称単数の形で主語と合いません。"),
 "g681": P(["most", "more", "much", "ever"], "Of all the candidates（全候補者のなかで）は最上級の文で、most qualified（最も適任）が入ります。more は2つの比較、much・ever は qualified の前に置いて最上級を表せません。"),
}
FIX.pop("g038b"); FIX.pop("g609")

# --- 問題文を直したもの（解説を作り直す）---
FULL = {
 "g718": F("He asked if the invoice ___ been sent the day before.", ["has", "had", "have", "having"],
           "He asked if the invoice had been sent the day before.", "彼は、請求書が前日に送られたかどうか尋ねた。",
           "the day before（前日に）があるので、尋ねた時点より前の出来事を表す過去完了形 had been sent を使います。has・have は現在完了形で、過去の時点と合いません。having は動詞の形になりません。",
           ["invoice：請求書", "the day before：前日に"]),
 "g819": F("The project fell ___ behind schedule due to supply issues.", ["soon", "too", "far", "very"],
           "The project fell far behind schedule due to supply issues.", "供給の問題で、プロジェクトは予定より大きく遅れた。",
           "behind（遅れて）を強めて「大きく」遅れたことを表す far が入ります。soon・too・very は behind の前に置いて「大きく遅れる」の意味になりません。",
           ["fall behind schedule：予定より遅れる", "supply issue：供給の問題"]),
 "g603": F("We are not sure yet, but the proposal ___ be approved by next week.", ["must", "will", "might", "shall"],
           "We are not sure yet, but the proposal might be approved by next week.", "まだ分からないが、その提案は来週までに承認されるかもしれない。",
           "「まだ分からない」と述べているので、可能性を表す might（～かもしれない）が合います。must は強い確信、will は確実な予定、shall は規則や取り決めを表し、不確実な内容には合いません。",
           ["be approved：承認される", "might：～かもしれない"]),
 "g029": F("The technician ___ the equipment by the time the inspection begins.", ["check", "will have checked", "checked", "checking"],
           "The technician will have checked the equipment by the time the inspection begins.", "点検が始まるまでに、技術者は機器を確認し終えているだろう。",
           "by the time ～（～するときまでに）は、未来のある時点までに完了していることを表すので、未来完了形 will have + 過去分詞 が入ります。check は三人称単数の s がなく、checked は過去形、checking は述語として成り立ちません。",
           ["technician：技術者", "equipment：機器", "by the time：～するときまでに", "inspection：点検"]),
 "g074": F("___ the heavy workload, she still finished the report on time.", ["Even", "Although", "However", "Despite"],
           "Despite the heavy workload, she still finished the report on time.", "仕事量が多かったにもかかわらず、彼女は時間どおりに報告書を仕上げた。",
           "後ろに名詞句 the heavy workload が続くので、「～にもかかわらず」を表す前置詞 Despite が入ります。Although は後ろに節が必要で、Even・However は名詞句の前に置けません。",
           ["workload：仕事量", "despite：～にもかかわらず", "on time：時間どおりに"]),
 "g246": F("___ her tiredness, she completed the assignment on time.", ["Regardless of", "Although", "Even", "Since"],
           "Regardless of her tiredness, she completed the assignment on time.", "疲れていたにもかかわらず、彼女は課題を時間どおりに仕上げた。",
           "後ろに名詞句 her tiredness が続くので、「～にかかわらず」を表す Regardless of が入ります。Although・Since は後ろに節が必要で、Even は名詞句の前に置けません。",
           ["tiredness：疲れ", "regardless of：～にかかわらず", "assignment：課題"]),
 "g412": F("The proposal will be put ___ a vote at the next meeting.", ["in", "to", "at", "by"],
           "The proposal will be put to a vote at the next meeting.", "その提案は、次の会議で採決にかけられる予定だ。",
           "put ～ to a vote で「～を採決にかける」という決まった言い方です。in・at・by は a vote の前で意味が通りません。",
           ["put to a vote：採決にかける", "proposal：提案"]),
 "g609": F("They ___ have finished the project earlier if they had had more resources.", ["can", "would", "must", "shall"],
           "They would have finished the project earlier if they had had more resources.", "もっと資源があれば、彼らはプロジェクトをもっと早く終えていただろう。",
           "if they had had ～（過去完了）の条件節に対し、帰結節は would have + 過去分詞（仮定法過去完了）になります。can・must・shall は、この用法には合いません。",
           ["resources：資源", "finish：終える", "earlier：もっと早く"]),
 "g026": F("Most of the employees ___ present at the annual meeting.", ["was", "were", "is", "has been"],
           "Most of the employees were present at the annual meeting.", "従業員の大半が、年次会議に出席していた。",
           "Most of the employees の employees は複数なので、複数形の were が入ります。was・is・has been は単数の主語につく形です。",
           ["most of：～の大半", "present：出席して", "annual meeting：年次会議"]),
 "g846": F("What impressed the board most last year ___ the team's dedication.", ["was", "were", "is", "are"],
           "What impressed the board most last year was the team's dedication.", "昨年、取締役会に最も強い印象を与えたのは、チームの献身だった。",
           "What ～ が主語の文は単数扱いで、last year（昨年）があるので過去形 was を使います。were・are は複数形、is は現在形で合いません。",
           ["impress：印象を与える", "board：取締役会", "dedication：献身"]),
 "g036": F("___ the two proposals, the second one is more cost-effective.", ["Between", "Both", "Either", "Neither"],
           "Between the two proposals, the second one is more cost-effective.", "2つの提案のうち、2つ目のほうが費用対効果が高い。",
           "「2つのうち」と、2つのものを比べるときは Between を使います。Both・Either・Neither は、後ろに the two ～ を直接続けられず、意味も合いません。",
           ["cost-effective：費用対効果が高い", "proposal：提案"]),
 "g203": F("The company's sales team ___ the new product at the trade show next month.", ["present", "presented", "presenting", "will present"],
           "The company's sales team will present the new product at the trade show next month.", "営業チームは、来月の見本市で新製品を紹介する予定だ。",
           "next month（来月）があるので、未来を表す will present を使います。presented は過去形、present は三人称単数の s がなく、presenting は述語として成り立ちません。",
           ["present：紹介する", "trade show：見本市"]),
 "g236": F("By the time the shipment arrives, the order ___ processed.", ["being", "will have been", "was", "had been"],
           "By the time the shipment arrives, the order will have been processed.", "荷物が到着するときまでには、注文の処理は済んでいるだろう。",
           "By the time ～（～するときまでに）の主節は、未来のある時点までの完了を表す未来完了形 will have been + 過去分詞 になります。being は述語になれず、was・had been は過去の時点を表すので合いません。",
           ["shipment：荷物", "process：処理する", "by the time：～するときまでに"]),
 "g585": F("The company is looking forward ___ the new fiscal year.", ["start", "to start", "started", "to starting"],
           "The company is looking forward to starting the new fiscal year.", "会社は、新しい会計年度の開始を楽しみにしている。",
           "look forward to の to は前置詞なので、後ろは動名詞（-ing）になり、to starting が入ります。to start は不定詞の形で、この文では使えません。",
           ["look forward to ～ing：～を楽しみにする", "fiscal year：会計年度"]),
 "g586": F("The consultant is used ___ with difficult clients.", ["to dealing", "deal", "dealing", "dealt"],
           "The consultant is used to dealing with difficult clients.", "そのコンサルタントは、難しい顧客への対応に慣れている。",
           "be used to ～ing は「～することに慣れている」という意味で、この to は前置詞なので、後ろに動名詞が続きます。deal・dealing・dealt は to がないと「慣れている」の意味になりません。",
           ["be used to ～ing：～することに慣れている", "deal with：対応する", "client：顧客"]),
 "g587": F("He got used ___ early every morning for the new job.", ["to waking", "wake", "waking", "woke"],
           "He got used to waking early every morning for the new job.", "彼は、新しい仕事のために毎朝早く起きることに慣れた。",
           "get used to ～ing は「～することに慣れる」という意味で、この to は前置詞なので、後ろに動名詞が続きます。wake・waking・woke は to がないと「慣れる」の意味になりません。",
           ["get used to ～ing：～することに慣れる", "wake：目が覚める"]),
 "g601": F("The office is closed, so you ___ submit the form online.", ["have to", "having to", "has to", "to have"],
           "The office is closed, so you have to submit the form online.", "事務所は閉まっているので、フォームはオンラインで提出しなければならない。",
           "主語が you なので、「～しなければならない」を表す have to が入ります。has to は三人称単数、having to・to have は述語になれません。",
           ["submit：提出する", "form：書式", "have to：～しなければならない"]),
 "g604": F("We are not sure, but the results ___ have been affected by the equipment malfunction.", ["must", "should", "might", "will"],
           "We are not sure, but the results might have been affected by the equipment malfunction.", "確かではないが、結果は機器の不具合の影響を受けたのかもしれない。",
           "「確かではない」と述べているので、過去への可能性を表す might have been（～だったかもしれない）が合います。must は強い確信、should は当然の期待、will は確実な未来を表し、不確実な内容には合いません。",
           ["affect：影響を与える", "malfunction：不具合"]),
 "g635": F("The staff, ___ worked overtime, finished the project ahead of schedule.", ["which", "whom", "whose", "who"],
           "The staff, who worked overtime, finished the project ahead of schedule.", "残業したスタッフは、予定より早くプロジェクトを終えた。",
           "先行詞が人（The staff）で、後ろに動詞 worked が続くので、主格の関係代名詞 who を使います。which は人に使わず、whom は目的格、whose は所有格で直後に名詞が必要です。",
           ["work overtime：残業する", "ahead of schedule：予定より早く"]),
 "g767": F("The team ___ finish the project by Friday if nothing goes wrong.", ["is", "can", "to", "finishing"],
           "The team can finish the project by Friday if nothing goes wrong.", "何も問題がなければ、チームは金曜日までにプロジェクトを終えられる。",
           "後ろに動詞の原形 finish が続くので、助動詞の can が入ります。is・to・finishing は、動詞の原形の前には置けません。",
           ["finish：終える", "if nothing goes wrong：何も問題がなければ"]),
 "g780": F("The plan was revised in ___ of the new regulations.", ["rule", "time", "role", "light"],
           "The plan was revised in light of the new regulations.", "その計画は、新しい規制を考慮して修正された。",
           "in light of ～は「～を考慮して」という決まった言い方です。rule・time・role は、in ～ of の形で意味が通りません。",
           ["in light of：～を考慮して", "revise：修正する", "regulation：規制"]),
 "g357": F("The company's marketing budget was allocated ___ several campaigns.", ["along", "among", "at", "by"],
           "The company's marketing budget was allocated among several campaigns.", "会社のマーケティング予算は、いくつかのキャンペーンに分配された。",
           "「複数のもの（3つ以上）の間に分配する」ときは among を使います。along・at・by は、分配先を表す形になりません。",
           ["allocate：割り当てる", "among：～の間で（3つ以上）", "campaign：キャンペーン"]),
 "g797": F("Not only ___ the project completed on time, but it also came under budget.", ["has", "did", "be", "was"],
           "Not only was the project completed on time, but it also came under budget.", "そのプロジェクトは時間どおりに完了しただけでなく、予算内にも収まった。",
           "Not only が文頭に来ると倒置（疑問文の語順）になり、was + 主語 + 過去分詞（受け身）の形になります。has・did・be は、この形になりません。",
           ["not only A but also B：A だけでなく B も", "under budget：予算内に"]),
}


def point_patch(expl, pt):
    new, n = re.subn(r"(\[ポイント\]\s*).+?(?=\n\n\[|\Z)", lambda m: m.group(1) + pt, expl, count=1, flags=re.S)
    assert n == 1, "解説に[ポイント]がない"
    return new


def build_expl(letter, key, comp, ja, pt, words):
    return (f"[正解] ({letter}) {key}\n完成文: {comp}\n全訳: {ja}\n\n[ポイント] {pt}\n\n[重要単語・表現]\n"
            + "\n".join(f"・{w}" for w in words))


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {x["id"]: x for x in data}
    changed = []
    for table, full in ((FIX, False), (FULL, True)):
        for gid, spec in table.items():
            x = by[gid]
            new_ch = spec["ch"]
            new_q = spec["q"] if full else x["question"]
            assert len(set(c.lower() for c in new_ch)) == 4, f"{gid}: 選択肢が重複"
            new_key = new_ch[x["answer"]]
            if full:
                if new_q.count("___") != 1 or new_q.replace("___", new_key) != spec["comp"]:
                    raise SystemExit(f"{gid}: 完成文が問題文＋正解と合わない: {spec['comp']!r}")
                new_expl = build_expl(LET[x["answer"]], new_key, spec["comp"], spec["ja"], spec["pt"], spec["words"])
            else:
                if x["choices"][x["answer"]] != new_key and gid != "g374":
                    raise SystemExit(f"{gid}: 正解の語句が変わってしまう: {x['choices'][x['answer']]} → {new_key}")
                new_expl = point_patch(x["explanation"], spec["pt"])
            if (x["question"], x["choices"], x["explanation"]) == (new_q, new_ch, new_expl):
                continue  # すでに修正済み
            x["question"], x["choices"], x["explanation"] = new_q, new_ch, new_expl
            changed.append(gid)
    print(f"修正 {len(changed)}件")
    if DRY:
        print("(dry-run: 書き込みなし)")
        return
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
