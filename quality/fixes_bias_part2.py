#!/usr/bin/env python3
"""Part 2：「正解が唯一の最長の選択肢」になる偏りの是正（2026-10-15）。1回限り・再実行しても何も変わらない。

  python3 tools/quality/fixes_bias_part2.py [--dry-run]

204問（61%）が「正解が唯一の最長」だったため、無作為に選んだ100問で、誤答の1つを、
同じ内容のまま少し長くして、正解より長くした。正解・正解の位置は変えない。
誤答は、問題文の単語を繰り返しただけの「引っかけ」なので、内容が正解に近づかないように付け足している。
"""
import json, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "listeningPart2.json"
DRY = "--dry-run" in sys.argv

# id: (誤答の位置, 元の誤答, 新しい誤答)
FIX = {
 "l2001": (0, "It starts next Monday.", "It starts next Monday morning in the main conference room."),
 "l2003": (0, "It's on the third floor.", "It's on the third floor, next to the break room."),
 "l2004": (2, "I submitted mine yesterday.", "I submitted mine yesterday, so I already got the refund."),
 "l2005": (0, "In Conference Room B.", "In Conference Room B, right after the lunch break."),
 "l2008": (0, "It's a two-year contract.", "It's a two-year contract with an option to renew."),
 "l2010": (1, "Yes, I would.", "Yes, I would, and I'd like it with some extra sugar."),
 "l2011": (1, "Yes, we should.", "Yes, we should go there together after the meeting ends."),
 "l2012": (2, "It's due next Friday.", "It's due next Friday, so we still have plenty of time."),
 "l2013": (1, "I work forty hours a week.", "I work about forty hours a week, including weekends."),
 "l2015": (1, "I really like this song.", "I really like this song, it reminds me of my college days."),
 "l2019": (0, "The conference starts at ten.", "The conference starts at ten in the main hall on the first floor."),
 "l2020": (1, "She presented it well last year.", "She presented it very well at the conference last year."),
 "l2023": (0, "The supplies arrived broken.", "The supplies arrived broken, so we sent them back."),
 "l2024": (2, "I usually take the bus to work.", "I usually take the bus to work, but sometimes I drive."),
 "l2028": (1, "The meeting is at three.", "The meeting is at three o'clock in the second-floor room."),
 "l2042": (0, "Visitors need to sign in first.", "Visitors need to sign in at the reception desk first."),
 "l2044": (1, "The branch office is in Seoul.", "The branch office is in Seoul, near the main station."),
 "l2048": (1, "The warehouse is quite large.", "The warehouse is quite large and holds most of our stock."),
 "l2051": (0, "The design looks fantastic.", "The design looks fantastic, especially the new color scheme."),
 "l2060": (1, "The client is a large company.", "The client is a large company with offices in five countries."),
 "l2066": (0, "The policy is quite strict.", "The policy is quite strict compared with the previous one."),
 "l2067": (1, "The meeting room is booked.", "The meeting room is quite small for that many people."),
 "l2075": (1, "The agenda has five items.", "The agenda has five items, including the budget review."),
 "l2084": (0, "The figures look promising.", "The figures look promising compared with last quarter's."),
 "l2085": (0, "The meeting is about the budget.", "The meeting is about the budget for the next fiscal year."),
 "l2086": (0, "The system was installed last week.", "The system was installed last week by the IT department."),
 "l2087": (0, "The picnic was fun last year.", "The picnic was a lot of fun last year at the lake."),
 "l2090": (0, "The numbers look correct to me.", "The numbers are in the third column of the table."),
 "l2091": (0, "It starts at ten o'clock.", "It starts at ten o'clock in the main conference room."),
 "l2093": (1, "It was updated last week.", "It was updated last week with the new product photos."),
 "l2095": (1, "She went to visit her family.", "She went to visit her family in Boston for two weeks."),
 "l2097": (1, "It expires at the end of the day.", "It expires at the end of the day, so please return it."),
 "l2101": (1, "The event starts at noon.", "The event starts at noon and lasts until about four."),
 "l2102": (1, "Denver is a large city.", "Denver is a large city with several of our regional offices."),
 "l2103": (0, "We switched suppliers last spring.", "We switched suppliers sometime last spring, I think."),
 "l2107": (1, "We sent it to five hundred customers.", "We sent it to five hundred customers across the country."),
 "l2110": (0, "It prints very quickly.", "It prints very quickly and handles large paper sizes."),
 "l2115": (0, "It should arrive by truck.", "It should arrive by truck, with the other deliveries."),
 "l2120": (0, "We ship every weekday.", "We ship every weekday except for national holidays."),
 "l2130": (1, "The projector is quite old.", "The projector is quite old, so the picture is a bit dim."),
 "l2133": (0, "The meeting starts at ten.", "The meeting starts at ten in the large conference room."),
 "l2144": (0, "The computers are on every desk.", "The computers are on every desk in the open-plan office."),
 "l2145": (0, "The copier is over by the window.", "The copier is over by the window next to the fax machine."),
 "l2147": (0, "Osaka is a large city in Japan.", "Osaka is a large city in western Japan, famous for food."),
 "l2150": (1, "The manual is fifty pages long.", "The manual is fifty pages long and written in small print."),
 "l2155": (1, "The contract is three pages long.", "The contract is three pages long, including the appendix."),
 "l2157": (0, "Delivery usually takes about a week.", "Delivery usually takes about a week, depending on the order."),
 "l2159": (0, "The order includes fifty units.", "The order includes fifty units of the larger model."),
 "l2160": (0, "The delivery usually takes two days.", "The delivery usually takes two days within the city."),
 "l2164": (0, "Everyone leaves at six normally.", "Everyone leaves at six normally, except during the busy season."),
 "l2165": (1, "She started two weeks ago.", "She started two weeks ago after moving from another city."),
 "l2168": (0, "We printed five hundred flyers last time.", "We printed five hundred flyers last time for the open house."),
 "l2169": (0, "The redesign will take three months.", "The redesign will take three months and cost a lot."),
 "l2173": (1, "The vendor is based overseas.", "The vendor is based overseas, mainly in Southeast Asia."),
 "l2175": (0, "We're running low on paper.", "We're running low on paper and printer toner this month."),
 "l2177": (0, "The workshop covers project management.", "The workshop covers project management and risk planning basics."),
 "l2181": (1, "The meeting is on Tuesday.", "The meeting is on Tuesday at nine in the boardroom."),
 "l2183": (0, "Training starts next Monday.", "Training starts next Monday and runs for about two weeks."),
 "l2185": (0, "We ordered fifty units.", "We ordered fifty units of each of the three models."),
 "l2189": (0, "We use a lot of paper here.", "We use a lot of paper here, mostly for client reports."),
 "l2191": (0, "The office opens at eight.", "The office opens at eight o'clock on weekday mornings."),
 "l2193": (0, "The campaign launched last week.", "The campaign launched last week with a large event."),
 "l2196": (1, "The flight is three hours long.", "The flight is three hours long, with one short stopover."),
 "l2199": (0, "The flight is quite expensive.", "The flight is quite expensive during the holiday season."),
 "l2202": (1, "We hired one last year.", "We hired one last year from a competitor's sales team."),
 "l2203": (0, "The machine was expensive.", "The machine was expensive when we first bought it last year."),
 "l2204": (0, "The competitor is based in Seattle.", "The competitor is based in Seattle and has been growing fast."),
 "l2205": (0, "The printer is quite old.", "The printer is quite old and was bought before I joined."),
 "l2207": (0, "The file is quite large.", "The file is quite large, over two hundred megabytes in size."),
 "l2209": (0, "The contract is two pages long.", "The contract is two pages long, plus a cover letter."),
 "l2210": (0, "The deadline is next Friday.", "The deadline is next Friday at five in the afternoon."),
 "l2211": (0, "The report is due today.", "The report is due today by the end of the business day."),
 "l2212": (1, "The project started in March.", "The project started in March after the permit was issued."),
 "l2216": (0, "The software was released last month.", "The software was released last month by a major developer."),
 "l2217": (0, "She starts on Monday.", "She starts on Monday, and her office is on the fourth floor."),
 "l2219": (0, "We have twenty extra chairs.", "We have twenty extra chairs left from last week's event."),
 "l2227": (0, "The partnership was signed last month.", "The partnership was signed last month at the head office."),
 "l2230": (0, "The posting went up last week.", "The posting went up last week on several job websites."),
 "l2234": (0, "We hired a consultant last year.", "We hired a consultant last year to review our accounting."),
 "l2237": (1, "This week has five business days.", "This week has five business days, just like every other week."),
 "l2239": (0, "The room fits about ten people.", "The room fits about ten people at the long table."),
 "l2247": (0, "The projector is broken.", "The projector is broken, so we are using the old screen."),
 "l2248": (1, "The building has ten floors.", "The building has ten floors and two elevators in the lobby."),
 "l2254": (0, "The flight leaves at noon.", "The flight leaves at noon from the second terminal."),
 "l2256": (0, "It's a comfortable chair.", "It's a comfortable chair, made by a famous designer."),
 "l2257": (0, "It opens at 9 AM.", "It opens at 9 AM and closes around six in the evening."),
 "l2258": (0, "The figures are on page five.", "The figures are on page five of the printed handout."),
 "l2263": (0, "In the main server room.", "In the main server room on the basement level."),
 "l2264": (0, "Around three o'clock.", "Around three o'clock yesterday afternoon, I think."),
 "l2281": (0, "It's a two-page document.", "It's a two-page document printed on both sides."),
 "l2283": (1, "The numbers look interesting.", "The numbers look interesting compared with last year's."),
 "l2285": (0, "It sells snacks and drinks.", "It sells snacks and drinks at fairly low prices."),
 "l2286": (0, "It's in the top drawer.", "It's in the top drawer of my desk."),
 "l2290": (1, "It was sent last week.", "It was sent last week by email."),
 "l2298": (0, "The warehouse is nearby.", "The warehouse is nearby, just off the main road."),
 "l2309": (0, "It was created last year.", "It was created last year by an outside company."),
 "l2312": (0, "It starts next month.", "It starts next month and runs for two years."),
 "l2323": (0, "Marketing is a big department.", "Marketing is a big department with forty employees."),
 "l2329": (1, "Maria joined last year.", "Maria joined last year after working in Paris."),
 "l2333": (0, "The process is efficient.", "The process is efficient and saves a lot of time."),
}


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by = {q["id"]: q for q in data}
    changed, problems = [], []
    for qid, (idx, old, new) in FIX.items():
        q = by[qid]
        if idx == q["answer"]:
            problems.append(f"{qid}: 差し替え位置が正解の位置"); continue
        correct = q["choices"][q["answer"]]
        if len(new) <= len(correct):
            problems.append(f"{qid}: 新しい誤答が正解より長くない（{len(new)} <= {len(correct)}）"); continue
        if q["choices"][idx] == new:
            continue  # すでに修正済み
        if q["choices"][idx] != old:
            problems.append(f"{qid}: 元の誤答が違う: {q['choices'][idx]!r}"); continue
        if old in (q.get("explanation") or ""):
            problems.append(f"{qid}: 解説に元の誤答の文がそのまま出てくる（要確認）")
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
