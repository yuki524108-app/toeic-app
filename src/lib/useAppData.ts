import { useCallback, useState } from "react";
import type { AppData, ProgressRecord } from "../types";
import {
  loadData,
  recordAnswer as persistAnswer,
  toggleBookmark as persistToggleBookmark,
} from "./storage";

export function useAppData() {
  const [data, setData] = useState<AppData>(() => loadData());

  const recordAnswer = useCallback((record: ProgressRecord) => {
    setData((prev) => persistAnswer(prev, record));
  }, []);

  const toggleBookmark = useCallback((itemId: string) => {
    setData((prev) => persistToggleBookmark(prev, itemId));
  }, []);

  const refresh = useCallback(() => {
    setData(loadData());
  }, []);

  return { data, recordAnswer, toggleBookmark, refresh };
}
