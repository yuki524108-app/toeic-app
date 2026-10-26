import { describe, it, expect } from "vitest";
import { addDaysLocal, addMonthsLocal, daysUntil, localDateStr, parseLocalDate } from "../../src/lib/date";
import { displayStreak } from "../../src/lib/streak";

describe("日付ユーティリティ（ローカル日付）", () => {
  it("日本時間の朝（UTCでは前日）でも、ローカルの日付になる", () => {
    const earlyMorningJst = new Date("2026-10-01T23:00:00Z"); // JST 10/2 08:00
    expect(earlyMorningJst.toISOString().slice(0, 10)).toBe("2026-10-01"); // UTCの日付は前日
    expect(localDateStr(earlyMorningJst)).toBe("2026-10-02");             // アプリが使うのはこちら
  });

  it("日数の加算は月・年をまたいでも正しい", () => {
    expect(localDateStr(addDaysLocal(new Date(2026, 0, 31, 12), 1))).toBe("2026-02-01");
    expect(localDateStr(addDaysLocal(new Date(2025, 11, 31, 12), 1))).toBe("2026-01-01");
    expect(localDateStr(addDaysLocal(new Date(2028, 1, 28, 12), 1))).toBe("2028-02-29"); // うるう日
    expect(localDateStr(addDaysLocal(new Date(2026, 9, 4, 12), -4))).toBe("2026-09-30");
  });

  it("月の加算は、翌月に同じ日がなければ月末に丸める", () => {
    expect(localDateStr(addMonthsLocal(new Date(2027, 0, 31), 1))).toBe("2027-02-28");
    expect(localDateStr(addMonthsLocal(new Date(2026, 7, 31), 6))).toBe("2027-02-28");
    expect(localDateStr(addMonthsLocal(new Date(2026, 9, 1), 6))).toBe("2027-04-01");
    expect(localDateStr(addMonthsLocal(new Date(2026, 9, 15), 12))).toBe("2027-10-15");
  });

  it("parseLocalDate は、存在しない日付や不正な形式を弾く", () => {
    expect(parseLocalDate("2026-02-30")).toBeNull();
    expect(parseLocalDate("2026-13-01")).toBeNull();
    expect(parseLocalDate("2026-1-1")).toBeNull();
    expect(parseLocalDate("bad")).toBeNull();
    expect(parseLocalDate("2028-02-29")).not.toBeNull();
    expect(localDateStr(parseLocalDate("2026-10-04")!)).toBe("2026-10-04");
  });

  it("daysUntil は、今日なら0、過去なら負、不正なら null", () => {
    expect(daysUntil("2026-10-11", "2026-10-01")).toBe(10);
    expect(daysUntil("2026-10-01", "2026-10-01")).toBe(0);
    expect(daysUntil("2026-09-29", "2026-10-01")).toBe(-2);
    expect(daysUntil("bad", "2026-10-01")).toBeNull();
  });
});

describe("displayStreak（表示する連続学習日数）", () => {
  const today = "2026-10-04";
  it("今日・昨日に学習していれば、保存されている連続日数を表示する", () => {
    expect(displayStreak(5, "2026-10-04", today)).toBe(5);
    expect(displayStreak(5, "2026-10-03", today)).toBe(5);
  });
  it("一昨日以前が最後なら、連続は途切れているので0日", () => {
    expect(displayStreak(5, "2026-10-02", today)).toBe(0);
    expect(displayStreak(30, "2026-09-24", today)).toBe(0);
  });
  it("学習日が未設定なら0日。時計が進んでいる（未来の日付）場合は継続中", () => {
    expect(displayStreak(7, null, today)).toBe(0);
    expect(displayStreak(3, "2026-10-06", today)).toBe(3);
  });
  it("月またぎ・うるう日・年またぎの境界", () => {
    expect(displayStreak(4, "2026-02-28", "2026-03-01")).toBe(4);
    expect(displayStreak(4, "2026-02-27", "2026-03-01")).toBe(0);
    expect(displayStreak(4, "2028-02-29", "2028-03-01")).toBe(4);
    expect(displayStreak(4, "2028-02-28", "2028-03-01")).toBe(0);
    expect(displayStreak(9, "2025-12-31", "2026-01-01")).toBe(9);
    expect(displayStreak(9, "2025-12-30", "2026-01-01")).toBe(0);
  });
  it("today が不正な形式でも落ちず、保存値を返す", () => {
    expect(displayStreak(2, "2026-01-01", "bad")).toBe(2);
  });
});
