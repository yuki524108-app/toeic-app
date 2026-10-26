import { describe, it, expect } from "vitest";
import progressSource from "../../src/pages/Progress.tsx?raw";
import historySource from "../../src/lib/history.ts?raw";
import missReasonSource from "../../src/lib/missReason.ts?raw";
import questionTypeStatsSource from "../../src/lib/questionTypeStats.ts?raw";
import backupSource from "../../src/lib/backup.ts?raw";
import storageSource from "../../src/lib/storage.ts?raw";

/**
 * 進捗画面は、問題データ本体（約5MB）を読み込まない。
 * 以前は、文法項目名を引くためだけに文法の問題データ（約640KB）を読み込んでいた。
 * 設問ID→カテゴリの小さな対応（grammarCategories.json、約20KB）と、問題タイプの索引（questionTypes.json）だけを使う。
 */
describe("進捗画面は、問題データ本体を読み込まない（読み込みを軽く保つためのガード）", () => {
  const DATA_IMPORT =
    /from\s+["'][^"']*data\/(words|grammar|readings|part6|listeningPart1|listeningPart2|listeningPart34)\.json["']/;

  it("Progress.tsx は、問題データ本体ではなく小さな索引だけを読み込む", () => {
    expect(progressSource).not.toMatch(DATA_IMPORT);
    expect(progressSource).toMatch(/data\/grammarCategories\.json/);
    expect(progressSource).toMatch(/data\/questionTypes\.json/);
  });

  it("進捗画面が使う集計・保存のコードも、問題データ本体を読み込まない", () => {
    for (const [name, src] of Object.entries({
      history: historySource,
      missReason: missReasonSource,
      questionTypeStats: questionTypeStatsSource,
      backup: backupSource,
      storage: storageSource,
    })) {
      expect(src, `${name}.ts が問題データを読み込んでいる`).not.toMatch(DATA_IMPORT);
    }
  });
});
