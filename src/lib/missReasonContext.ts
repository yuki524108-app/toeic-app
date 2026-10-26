import { createContext } from "react";
import type { MissReason } from "../types";

/**
 * 間違えた理由を記録する関数を、画面の深い階層（各問題の解説）へ渡すための仕組み。
 * App が提供する。提供されていない場所（テストなど）では、理由の選択を表示しない。
 */
export type MissReasonRecorder = (
  itemId: string,
  next: MissReason | null,
  prev: MissReason | null
) => void;

export const MissReasonContext = createContext<MissReasonRecorder | null>(null);
