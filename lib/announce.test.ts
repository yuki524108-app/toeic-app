import { describe, it, expect } from "vitest";
import { answerLabel, verdictMessage } from "../../src/lib/announce";
import { titleForPath } from "../../src/lib/routeTitle";

describe("通知文（色だけに頼らず正誤を伝える）", () => {
  it("正解のときは「正解です」と解説を伝える", () => {
    expect(verdictMessage(true, "B. went", "過去形が入る。")).toBe("正解です。解説。過去形が入る。");
  });
  it("不正解のときは正解の選択肢を伝える", () => {
    expect(verdictMessage(false, "B. went", "過去形が入る。")).toBe(
      "不正解です。正解は B. went。解説。過去形が入る。"
    );
  });
  it("解説の改行・連続した空白は1つの空白にまとめる", () => {
    expect(verdictMessage(true, null, "1行目\n\n  2行目")).toBe("正解です。解説。1行目 2行目");
  });
  it("解説がなければ正誤だけを伝える", () => {
    expect(verdictMessage(false, null, null)).toBe("不正解です。");
  });
  it("正解の選択肢は A〜D の記号つきで表す", () => {
    expect(answerLabel(["a", "b", "c", "d"], 2)).toBe("C. c");
  });
});

describe("画面ごとのタブの題名", () => {
  it("パスに応じた題名を返し、パラメータつきのパスも解決する", () => {
    expect(titleForPath("/grammar")).toBe("文法問題 | TOEIC Drill");
    expect(titleForPath("/mock-test-review/abc")).toBe("模試の振り返り | TOEIC Drill");
    expect(titleForPath("/mock-test")).toBe("模試モード | TOEIC Drill");
  });
  it("ホームや未知のパスはアプリ名だけにする", () => {
    expect(titleForPath("/")).toBe("TOEIC Drill");
    expect(titleForPath("/unknown")).toBe("TOEIC Drill");
  });
});
