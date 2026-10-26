#!/usr/bin/env node
/**
 * 問題タイプの索引（src/data/questionTypes.json）を生成する。
 *
 * 進捗画面で「問題タイプ別の正答率」を出すために、設問ID→問題タイプの対応を小さなファイルにしておく
 * （問題データ約5MBを読み込まずに済む）。分類の規則は src/lib/questionType.ts にあり、このスクリプトはそれを
 * そのまま使う（規則を二重に持たない）。
 *
 *   node tools/build_question_types.mjs          # 索引を生成して src/data/questionTypes.json に書き出す
 *   node tools/build_question_types.mjs --check  # 索引が問題データ・規則と一致しているか検査する（ずれていれば終了コード1）
 *

 * 実行には Node 22.18 以降が必要（TypeScript の規則ファイルを、そのまま読み込むため）。
 *
 * 問題データ（src/data/*.json）または分類の規則を変えたら、このスクリプトを実行する。
 * 一致しているかは、自動テスト（tests/data/questionTypes.test.ts）でも検査される。
 *
 * 索引の形式：{ "設問ID": "r:purpose" | "p2:who" | ... }（読解・Part 3/4は "r:"、Part 2は "p2:"）
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "src/data");
const load = (name) => JSON.parse(readFileSync(resolve(DATA, `${name}.json`), "utf-8"));

// 規則のファイル（TypeScript）を、Node の型除去の機能でそのまま読み込む（Node 22.18 以降。それ以前は --experimental-strip-types が必要）
const { classifyReadingQuestion, classifyPart2Question } = await import(
  pathToFileURL(resolve(ROOT, "src/lib/questionType.ts")).href
);

const index = {};
for (const p of load("readings")) for (const q of p.questions) index[q.id] = `r:${classifyReadingQuestion(q.question)}`;
for (const s of load("listeningPart34")) for (const q of s.questions) index[q.id] = `r:${classifyReadingQuestion(q.question)}`;
for (const q of load("listeningPart2")) index[q.id] = `p2:${classifyPart2Question(q.question)}`;

const expected = JSON.stringify(index);
const path = resolve(DATA, "questionTypes.json");
if (process.argv.includes("--check")) {
  const actual = existsSync(path) ? readFileSync(path, "utf-8") : null;
  if (actual !== expected) {
    console.error("src/data/questionTypes.json が問題データ・分類の規則とずれています。node tools/build_question_types.mjs を実行してください。");
    process.exit(1);
  }
  console.log(`OK: ${Object.keys(index).length}問の索引が一致しています`);
} else {
  writeFileSync(path, expected);
  console.log(`${path} を書き出しました（${Object.keys(index).length}問、${expected.length}文字）`);
}
