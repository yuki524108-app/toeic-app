import { useCallback, useState } from "react";
import type { AppData, MissReason, MockTestResult, ProgressRecord } from "../types";
import {
  loadData,
  recordAnswer as persistAnswer,
  toggleBookmark as persistToggleBookmark,
  setMissReason as persistSetMissReason,
  completePlacementTest as persistCompletePlacementTest,
  recordMockTestResult as persistRecordMockTestResult,
  replaceAllData as persistReplaceAllData,
  setTargetGoal as persistSetTargetGoal,
} from "./storage";

export function useAppData() {
  const [data, setData] = useState<AppData>(() => loadData());

  const recordAnswer = useCallback((record: ProgressRecord) => {
    setData((prev) => persistAnswer(prev, record));
  }, []);

  const toggleBookmark = useCallback((itemId: string) => {
    setData((prev) => persistToggleBookmark(prev, itemId));
  }, []);

  const setMissReason = useCallback(
    (itemId: string, next: MissReason | null, prev: MissReason | null) => {
      setData((p) => persistSetMissReason(p, itemId, next, prev));
    },
    []
  );

  const completePlacementTest = useCallback(() => {
    setData((prev) => persistCompletePlacementTest(prev));
  }, []);

  const recordMockTestResult = useCallback((result: MockTestResult) => {
    setData((prev) => persistRecordMockTestResult(prev, result));
  }, []);

  const setTargetGoal = useCallback(
    (score: number | null, date: string | null) => {
      setData((prev) => persistSetTargetGoal(prev, score, date));
    },
    []
  );

  const importData = useCallback((newData: AppData) => {
    setData(persistReplaceAllData(newData));
  }, []);

  const refresh = useCallback(() => {
    setData(loadData());
  }, []);

  return {
    data,
    recordAnswer,
    toggleBookmark,
    setMissReason,
    completePlacementTest,
    recordMockTestResult,
    setTargetGoal,
    importData,
    refresh,
  };
}
