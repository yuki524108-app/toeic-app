/** 画面（パス）ごとのタブの題名 */
const TITLES: [string, string][] = [
  ["/words", "単語学習"],
  ["/grammar", "文法問題"],
  ["/reading", "リーディング"],
  ["/part6", "長文穴埋め（Part 6）"],
  ["/listening-part1", "リスニング（Part 1）"],
  ["/listening-part2", "リスニング（Part 2）"],
  ["/listening-part34", "リスニング（Part 3・4）"],
  ["/review", "復習"],
  ["/progress", "進捗"],
  ["/placement-test", "初回模試"],
  ["/mock-test-review", "模試の振り返り"],
  ["/mock-test", "模試モード"],
  ["/quick-study", "すきま時間モード"],
  ["/timed-drill", "時間感覚トレーニング"],
  ["/dictation", "ディクテーション"],
];

export function titleForPath(pathname: string): string {
  const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit ? `${hit[1]} | TOEIC Drill` : "TOEIC Drill";
}
