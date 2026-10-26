#!/usr/bin/env python3
"""Part 2：「正解が中間の長さ」に偏った分を均す（2026-10-16）。1回限り・再実行しても何も変わらない。

  python3 tools/quality/fixes_bias_part2b.py [--dry-run]

fixes_bias_part2.py で「最長が正解」を減らした結果、「最短が正解」が11%しかなく、
「中間が正解」が47%になった（偶然なら各33%）。最短の誤答をもう1つ長くして、
正解が最短になる問題を増やす。誤答の内容は、正解に近づかないように付け足している。
"""
import json, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "listeningPart2.json"
DRY = "--dry-run" in sys.argv

# id: (元の誤答, 新しい誤答)
FIX = {
 "l2001": ("About three weeks, I think.", "About three weeks, I think, but it might take longer."),
 "l2010": ("No, I already had lunch.", "No, I already had lunch with some colleagues earlier."),
 "l2012": ("I'll print it now.", "I'll print it now and bring a copy to the meeting."),
 "l2014": ("It's down the hall.", "It's down the hall, past the copy room on your left."),
 "l2017": ("Yes, I received the letter.", "Yes, I received the letter you sent last week."),
 "l2020": ("It's scheduled for tomorrow.", "It's scheduled for tomorrow at ten in the main hall."),
 "l2024": ("The train arrives at noon.", "The train arrives at noon on the second platform every day."),
 "l2025": ("Yes, I'm attending.", "Yes, I'm attending, and I'm bringing two of my colleagues."),
 "l2028": ("I already attended the meeting.", "I already attended the meeting yesterday with the whole team."),
 "l2048": ("We visited it last week.", "We visited it last week to check the new shelves."),
 "l2052": ("The email was quite long.", "The email was quite long and had several attachments."),
 "l2060": ("I visited them last week.", "I visited them last week and signed the new agreement."),
 "l2067": ("I already had a meeting today.", "I already had a meeting today with the whole sales team."),
 "l2070": ("Last year it was very popular.", "Last year it was very popular, with over two hundred guests."),
 "l2083": ("I usually shop on Saturdays.", "I usually shop on Saturdays, when there are fewer crowds."),
 "l2087": ("We usually go to the same park.", "We usually go to the same park near the riverside trail."),
 "l2090": ("I already sent the numbers.", "I already sent the numbers to the client this morning."),
 "l2093": ("The website looks great now.", "The website looks great now with the redesigned homepage."),
 "l2107": ("The survey covered several topics.", "The survey covered several topics, including pricing and service."),
 "l2130": ("It's stored in the supply closet.", "It's stored in the supply closet on the second floor."),
 "l2133": ("I'll bring some snacks too.", "I'll bring some snacks too, from the bakery across the street."),
 "l2139": ("It rained a lot yesterday.", "It rained a lot yesterday, so the streets are still wet."),
 "l2155": ("It was drafted by our legal team.", "It was drafted by our legal team in the head office last month."),
 "l2157": ("We compared prices from three suppliers.", "We compared prices from three suppliers last quarter."),
 "l2160": ("We ordered from our usual supplier.", "We ordered from our usual supplier in the northern region."),
 "l2164": ("The office closes at seven.", "The office closes at seven o'clock on most weekday evenings."),
 "l2167": ("Volunteers should arrive by eight.", "Volunteers should arrive by eight to receive their T-shirts."),
 "l2175": ("Supplies are ordered every month.", "Supplies are ordered every month through an online catalog."),
 "l2200": ("The boxes are quite heavy.", "The boxes are quite heavy, so be careful with the glass."),
 "l2203": ("We bought it last month.", "We bought it last month from a store near the station."),
 "l2204": ("Their product launched last week.", "Their product launched last week at the trade show in Berlin."),
 "l2211": ("Reports are usually five pages.", "Reports are usually five pages long with a short summary."),
 "l2212": ("It's a large commercial building.", "It's a large commercial building with twelve floors downtown."),
 "l2216": ("It replaces our old system.", "It replaces our old system, which was installed years ago."),
 "l2217": ("The role oversees the sales team.", "The role oversees the sales team in the eastern region."),
 "l2221": ("The client is based in New York.", "The client is quite satisfied with our work so far."),
 "l2227": ("It's a five-year agreement.", "It's a five-year agreement with an option to renew."),
 "l2230": ("It's for a marketing position.", "It's for a marketing position in the downtown office."),
 "l2232": ("The meeting starts in an hour.", "The meeting starts in an hour in the large conference room."),
 "l2234": ("Consultants can be expensive.", "Consultants can be expensive, especially for small teams."),
 "l2242": ("Around 3 PM.", "Around 3 PM, right before the office closes."),
 "l2254": ("It costs around $300.", "It costs around $300 for a round-trip ticket."),
 "l2256": ("I bought it last year.", "I bought it last year at a store on Main Street."),
 "l2257": ("About two hundred people.", "About two hundred people attended the conference."),
 "l2258": ("We submitted it yesterday.", "We submitted it yesterday afternoon before the deadline."),
 "l2259": ("It's due next week.", "It's due next week at the downtown branch office."),
 "l2269": ("He worked here before.", "He worked here before, in the finance department."),
 "l2271": ("About $500 total.", "About $500 total, including the taxi fare."),
 "l2278": ("The delay was minor.", "The delay was minor and only affected one shipment."),
 "l2283": ("The report is due tomorrow.", "The report is due tomorrow at noon in the head office."),
 "l2285": ("It's on the second floor.", "It's on the second floor next to the staff lounge."),
 "l2286": ("About six months ago.", "About six months ago, when we signed the first draft."),
 "l2293": ("The office is downtown.", "The office is downtown, close to the central station."),
 "l2296": ("It's a small company.", "It's a small company located on the west side."),
 "l2298": ("It contains fifty units.", "It contains fifty units of the new product model."),
 "l2303": ("Other departments are busy.", "Other departments are busy preparing for the audit."),
 "l2328": ("The update takes an hour.", "The update takes an hour, so please save your work."),
 "l2329": ("The project starts soon.", "The project starts soon, with a kickoff on Monday."),
}


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {q["id"]: q for q in data}
    changed, problems = [], []
    for qid, (old, new) in FIX.items():
        q = by[qid]
        if new in q["choices"]:
            continue  # すでに修正済み
        if old not in q["choices"]:
            problems.append(f"{qid}: 元の誤答が見つからない: {old!r}"); continue
        idx = q["choices"].index(old)
        correct = q["choices"][q["answer"]]
        if idx == q["answer"]:
            problems.append(f"{qid}: 差し替え位置が正解"); continue
        if len(new) <= len(correct):
            problems.append(f"{qid}: 新しい誤答が正解より長くない（{len(new)} <= {len(correct)}）"); continue
        if old in (q.get("explanation") or ""):
            problems.append(f"{qid}: 解説に元の誤答の文がそのまま出てくる（要確認）"); continue
        q["choices"][idx] = new
        changed.append(qid)
    print(f"修正 {len(changed)}件 / 問題 {len(problems)}件")
    for m in problems:
        print("  ", m)
    if problems:
        sys.exit(1)
    if not DRY:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
