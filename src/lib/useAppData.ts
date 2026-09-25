import { useCallback, useState } from "react";
import type { AppData, MockTestResult, ProgressRecord } from "../types";
import {
  loadData,
  recordAnswer as persistAnswer,
  toggleBookmark as persistToggleBookmark,
  completePlacementTest as persistCompletePlacementTest,
  recordMockTestResult as persistRecordMockTestResult,
} from "./storage";

export function useAppData() {
  const [data, setData] = useState<AppData>(() => loadData());

  const recordAnswer = useCallback((record: ProgressRecord) => {
    setData((prev) => persistAnswer(prev, record));
  }, []);

  const toggleBookmark = useCallback((itemId: string) => {
    setData((prev) => persistToggleBookmark(prev, itemId));
  }, []);

  const completePlacementTest = useCallback(() => {
    setData((prev) => persistCompletePlacementTest(prev));
  }, []);

  const recordMockTestResult = useCallback((result: MockTestResult) => {
    setData((prev) => persistRecordMockTestResult(prev, result));
  }, []);

  const refresh = useCallback(() => {
    setData(loadData());
  }, []);

  return {
    data,
    recordAnswer,
    toggleBookmark,
    completePlacementTest,
    recordMockTestResult,
    refresh,
  };
}
