import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import part1 from "../data/listeningPart1.json";
import part2 from "../data/listeningPart2.json";
import part34 from "../data/listeningPart34.json";
import type { ListeningPart1Item, ListeningPart2Question, ListeningPart34Set } from "../types";
import {
  DICTATION_COUNT,
  DICTATION_LENGTHS,
  buildDictationPool,
  diffWords,
  pickLines,
} from "../lib/dictation";
import type { DictationDiff, DictationLengthId, DictationLine } from "../lib/dictation";
import { isTTSSupported, speak, stopSpeaking } from "../lib/tts";
import { Announce } from "../components/Announce";
import { FocusLabel } from "../components/FocusLabel";

/**
 * ディクテーション（2.1.34）。英文を聞き取って書き取り、答え合わせで「聞き取れなかった単語」を確かめる。
 * 何度でも聞き直せる（再生回数は結果に出る）。単語ごとに突き合わせるので、1語抜けても、そのあとが全部間違いにならない。
 * 学習の記録（進捗・連続学習日数）には反映しない（英文は問題として管理していないため）。
 */

const RATES = [0.75, 1] as const;
const LENGTH_KEY = "toeic-app:dictation-length";
const RATE_KEY = "toeic-app:dictation-rate";

const POOL = buildDictationPool({
  part1: part1 as ListeningPart1Item[],
  part2: part2 as ListeningPart2Question[],
  part34: part34 as ListeningPart34Set[],
});

function loadLength(): DictationLengthId {
  try {
    const v = localStorage.getItem(LENGTH_KEY);
    return DICTATION_LENGTHS.some((l) => l.id === v) ? (v as DictationLengthId) : "short";
  } catch {
    return "short";
  }
}

function loadRate(): number {
  try {
    const v = Number(localStorage.getItem(RATE_KEY));
    return (RATES as readonly number[]).includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 設定を記憶できなくても学習には影響しないので、黙って無視する
  }
}

type Outcome = { line: DictationLine; diff: DictationDiff; plays: number; gaveUp: boolean };

export default function Dictation() {
  const [length, setLength] = useState<DictationLengthId>(loadLength);
  const [rate, setRate] = useState<number>(loadRate);
  const [lines, setLines] = useState<DictationLine[] | null>(null);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [checked, setChecked] = useState<Outcome | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  // いまの再生を識別する番号。新しく再生する・次の問題へ進む・画面を離れるたびに増やし、古い再生の後始末を無効にする
  const runId = useRef(0);

  useEffect(
    () => () => {
      runId.current += 1;
      stopSpeaking();
    },
    []
  );

  const supported = isTTSSupported();
  const available = useMemo(() => POOL.length, []);
  const current = lines?.[index];

  async function play() {
    if (!current) return;
    stopSpeaking();
    runId.current += 1;
    const mine = runId.current;
    setPlays((n) => n + 1);
    setPlaying(true);
    await speak(current.text, rate);
    if (runId.current === mine) setPlaying(false);
  }

  function start() {
    const picked = pickLines(POOL, length);
    if (picked.length === 0) return;
    stopSpeaking();
    runId.current += 1;
    setLines(picked);
    setIndex(0);
    setInput("");
    setPlays(0);
    setPlaying(false);
    setChecked(null);
    setOutcomes([]);
  }

  function check(gaveUp: boolean) {
    if (!current || checked) return;
    stopSpeaking();
    runId.current += 1;
    setPlaying(false);
    const outcome: Outcome = { line: current, diff: diffWords(current.text, gaveUp ? "" : input), plays, gaveUp };
    setChecked(outcome);
    setOutcomes((o) => [...o, outcome]);
  }

  function next() {
    stopSpeaking();
    runId.current += 1;
    setPlaying(false);
    setChecked(null);
    setInput("");
    setPlays(0);
    setIndex((i) => i + 1);
  }

  const back = (
    <Link to="/" className="text-sm text-(--color-muted)">
      ← ホーム
    </Link>
  );

  // ---------- 設定画面 ----------
  if (lines === null) {
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        {back}
        <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">ディクテーション</h1>
        <p className="mt-2 text-sm leading-relaxed text-(--color-ink-soft)">
          英文を聞き取って書き取る練習です。何度でも聞き直せます。答え合わせでは、聞き取れなかった単語を確かめられます。
          リスニングの問題の英文（Part 1〜4）から{DICTATION_COUNT}文を選びます。
        </p>

        {!supported ? (
          <p role="status" className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-4 text-sm leading-relaxed text-(--color-ink-soft)">
            この端末・ブラウザでは、英語の音声を再生できないため、ディクテーションを利用できません。
          </p>
        ) : (
          <>
            <p className="mt-6 text-sm font-medium text-(--color-ink)">英文の長さ</p>
            <div role="group" aria-label="英文の長さ" className="mt-2 grid grid-cols-3 gap-2">
              {DICTATION_LENGTHS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLength(l.id);
                    remember(LENGTH_KEY, l.id);
                  }}
                  aria-pressed={length === l.id}
                  className={`rounded-sm border py-3 text-center ${
                    length === l.id ? "border-(--color-gold) bg-(--color-gold-soft) text-(--color-ink)" : "border-(--color-line) text-(--color-muted)"
                  }`}
                >
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="block text-[10px]">{l.hint}</span>
                </button>
              ))}
            </div>

            <p className="mt-5 text-sm font-medium text-(--color-ink)">再生の速さ</p>
            <div role="group" aria-label="再生の速さ" className="mt-2 grid grid-cols-2 gap-2">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRate(r);
                    remember(RATE_KEY, String(r));
                  }}
                  aria-pressed={rate === r}
                  className={`rounded-sm border py-2.5 text-sm ${
                    rate === r ? "border-(--color-gold) bg-(--color-gold-soft) font-medium text-(--color-ink)" : "border-(--color-line) text-(--color-muted)"
                  }`}
                >
                  {r}倍{r === 0.75 ? "（ゆっくり）" : "（ふつう）"}
                </button>
              ))}
            </div>

            <button
              onClick={start}
              className="mt-8 w-full rounded-sm bg-(--color-ink) py-3.5 text-sm font-medium text-(--color-paper)"
            >
              {DICTATION_COUNT}文を始める
            </button>
            <p className="mt-3 text-xs leading-relaxed text-(--color-muted)">
              収録している英文：{available}文。この練習は学習の記録（進捗・連続学習日数）には反映されません。
            </p>
          </>
        )}
      </div>
    );
  }

  // ---------- 結果画面 ----------
  if (!current) {
    const avg = outcomes.length === 0 ? 0 : outcomes.reduce((n, o) => n + o.diff.accuracy, 0) / outcomes.length;
    return (
      <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
        {back}
        <h1 className="mt-4 font-(family-name:--font-display) text-2xl font-medium text-(--color-ink)">結果</h1>
        <div className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-5">
          <p className="text-2xl font-medium text-(--color-ink)">聞き取れた単語 {Math.round(avg * 100)}%</p>
          <p className="mt-2 text-sm text-(--color-ink-soft)">
            {outcomes.reduce((n, o) => n + o.diff.matched, 0)} / {outcomes.reduce((n, o) => n + o.diff.total, 0)}語
          </p>
        </div>
        <ul className="mt-4 space-y-2">
          {outcomes.map((o, i) => (
            <li key={i} className="rounded-sm border border-(--color-line) p-3">
              <p className="text-sm text-(--color-ink)">{o.line.text}</p>
              <p className="mt-1 text-xs text-(--color-muted)">
                {o.gaveUp ? "答えを見た" : `${Math.round(o.diff.accuracy * 100)}%（${o.diff.matched}/${o.diff.total}語）`} ・ 再生 {o.plays}回 ・ {o.line.source}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={() => setLines(null)} className="rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper)">
            もう一度やる
          </button>
          <Link to="/" className="rounded-sm border border-(--color-line) py-3 text-center text-sm font-medium text-(--color-ink)">
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  // ---------- 出題画面 ----------
  const isLast = index === lines.length - 1;
  const missing = checked ? checked.diff.tokens.filter((t) => t.status === "missing").map((t) => t.word) : [];
  return (
    <div className="mx-auto flex max-w-md flex-col px-5 pb-28 pt-8">
      <div className="flex items-center justify-between">
        {back}
        <FocusLabel changeKey={index} className="text-xs text-(--color-muted)">
          ディクテーション ・ {index + 1} / {lines.length}
        </FocusLabel>
      </div>

      <div className="mt-6 rounded-sm border border-(--color-line) bg-(--color-paper-raised) p-6 text-center">
        <p className="text-xs text-(--color-muted)">聞こえた英文を、下に書き取ってください</p>
        <button
          onClick={play}
          className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-(--color-ink) text-(--color-paper)"
          aria-label={plays === 0 ? "英文を再生する" : "もう一度再生する"}
        >
          <span aria-hidden="true" className="text-2xl">
            {playing ? "…" : "▶"}
          </span>
        </button>
        <p className="mt-3 text-xs text-(--color-muted)">
          {playing ? "再生中…" : plays === 0 ? "タップして再生" : `もう一度聞く（再生 ${plays}回）`}
        </p>
      </div>

      {!checked && (
        <div className="mt-4">
          <label htmlFor="dictation-input" className="text-xs text-(--color-muted)">
            聞き取った英文
          </label>
          <textarea
            id="dictation-input"
            lang="en"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-sm border border-(--color-line) bg-(--color-paper-raised) px-4 py-3 text-base text-(--color-ink)"
          />
          <button
            onClick={() => check(false)}
            disabled={input.trim() === ""}
            className="mt-3 w-full rounded-sm bg-(--color-ink) py-3 text-sm font-medium text-(--color-paper) disabled:opacity-40"
          >
            答え合わせ
          </button>
          <button
            onClick={() => check(true)}
            className="mt-2 w-full rounded-sm border border-(--color-line) py-2.5 text-xs text-(--color-muted)"
          >
            わからない（答えを見る）
          </button>
        </div>
      )}

      {checked && (
        <div role="region" aria-label="答え合わせ" className="mt-4 rounded-sm border border-(--color-line) bg-(--color-paper) p-4">
          <Announce
            message={
              checked.gaveUp
                ? `正解の英文は、${checked.line.text}`
                : `聞き取れた単語は${checked.diff.total}語中${checked.diff.matched}語。${missing.length > 0 ? `聞き取れなかった単語：${missing.join("、")}。` : "すべて聞き取れました。"}`
            }
          />
          <p className="text-sm font-medium text-(--color-ink)">
            {checked.gaveUp ? "正解の英文" : `聞き取れた単語：${checked.diff.matched} / ${checked.diff.total}語（${Math.round(checked.diff.accuracy * 100)}%）`}
          </p>
          <p className="mt-3 text-base leading-relaxed text-(--color-ink)">
            {checked.diff.tokens.map((t, k) => (
              <span
                key={k}
                className={
                  t.status === "ok" || checked.gaveUp
                    ? "mr-1.5"
                    : "mr-1.5 rounded-sm bg-(--color-incorrect-soft) px-0.5 font-medium text-(--color-incorrect) underline decoration-wavy"
                }
              >
                {t.word}
                {t.status === "missing" && !checked.gaveUp && <span className="sr-only">（聞き取れなかった）</span>}
              </span>
            ))}
          </p>
          {!checked.gaveUp && missing.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-(--color-muted)">聞き取れなかった単語：{missing.join("、")}</p>
          )}
          {!checked.gaveUp && checked.diff.extra.length > 0 && (
            <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">余分に入力した単語：{checked.diff.extra.join("、")}</p>
          )}
          {checked.line.ja && <p className="mt-3 text-sm leading-relaxed text-(--color-ink-soft)">{checked.line.ja}</p>}
          <p className="mt-2 text-xs text-(--color-muted)">{checked.line.source} ・ 再生 {checked.plays}回</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={play}
              className="flex-1 rounded-sm border border-(--color-line) py-2.5 text-xs text-(--color-ink)"
            >
              もう一度聞く
            </button>
            <button
              onClick={next}
              className="flex-[2] rounded-sm bg-(--color-ink) py-2.5 text-sm font-medium text-(--color-paper)"
            >
              {isLast ? "結果を見る" : "次の英文へ"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
