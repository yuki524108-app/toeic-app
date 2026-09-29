import grammarQuestions from "../data/grammar.json";
import readings from "../data/readings.json";
import part6Data from "../data/part6.json";
import listeningPart1Items from "../data/listeningPart1.json";
import listeningPart2Questions from "../data/listeningPart2.json";
import listeningPart34Sets from "../data/listeningPart34.json";
import type {
  GrammarQuestion,
  ItemType,
  ListeningPart1Item,
  ListeningPart2Question,
  ListeningPart34Set,
  ListeningScriptLine,
  Part6Passage,
  ReadingPassage,
} from "../types";

const grammarPool = grammarQuestions as GrammarQuestion[];
const readingPool = readings as ReadingPassage[];
const part6Pool = part6Data as Part6Passage[];
const part1Pool = listeningPart1Items as ListeningPart1Item[];
const part2Pool = listeningPart2Questions as ListeningPart2Question[];
const part34Pool = listeningPart34Sets as ListeningPart34Set[];

/**
 * 模試レビュー画面で1設問を表示するために必要な情報をまとめた形。
 * 設問の種類によって元データの構造（単独の設問 / パッセージ内の設問 / 空欄）が異なるため、
 * ここで共通の形に正規化する。
 */
export type ReviewableContent = {
  prompt: string; // 設問文（Part1は固定の案内文、Part6は「空欄(n)」）
  choices: string[];
  correctAnswer: number;
  explanation: string;
  passageTitle?: string;
  passageText?: string;
  passageTitle2?: string;
  passageText2?: string;
  passageTitle3?: string;
  passageText3?: string;
  image?: string; // Part1のSVG
  script?: ListeningScriptLine[]; // Part3・4
  setTitle?: string; // Part3・4のセットタイトル
};

/** 模試の設問id・種別から、レビュー表示に必要な元データを引き当てる */
export function findReviewContent(
  id: string,
  itemType: ItemType
): ReviewableContent | null {
  if (itemType === "grammar") {
    const item = grammarPool.find((g) => g.id === id);
    if (!item) return null;
    return {
      prompt: item.question,
      choices: item.choices,
      correctAnswer: item.answer,
      explanation: item.explanation,
    };
  }

  if (itemType === "part6") {
    for (const passage of part6Pool) {
      const blankIndex = passage.blanks.findIndex((b) => b.id === id);
      if (blankIndex !== -1) {
        const blank = passage.blanks[blankIndex];
        return {
          prompt: `空欄 (${blankIndex + 1})`,
          choices: blank.choices,
          correctAnswer: blank.answer,
          explanation: blank.explanation,
          passageTitle: passage.title,
          passageText: passage.passage,
        };
      }
    }
    return null;
  }

  if (itemType === "reading") {
    for (const passage of readingPool) {
      const q = passage.questions.find((q) => q.id === id);
      if (q) {
        return {
          prompt: q.question,
          choices: q.choices,
          correctAnswer: q.answer,
          explanation: q.explanation,
          passageTitle: passage.title,
          passageText: passage.passage,
          passageTitle2: passage.title2,
          passageText2: passage.passage2,
          passageTitle3: passage.title3,
          passageText3: passage.passage3,
        };
      }
    }
    return null;
  }

  if (itemType === "listeningPart1") {
    const item = part1Pool.find((p) => p.id === id);
    if (!item) return null;
    return {
      prompt: "写真を最も適切に描写している英文を選んでください。",
      choices: item.choices,
      correctAnswer: item.answer,
      explanation: item.explanation,
      image: item.image,
    };
  }

  if (itemType === "listeningPart2") {
    const item = part2Pool.find((p) => p.id === id);
    if (!item) return null;
    return {
      prompt: item.question,
      choices: item.choices,
      correctAnswer: item.answer,
      explanation: item.explanation,
    };
  }

  if (itemType === "listeningPart34") {
    for (const set of part34Pool) {
      const q = set.questions.find((q) => q.id === id);
      if (q) {
        return {
          prompt: q.question,
          choices: q.choices,
          correctAnswer: q.answer,
          explanation: q.explanation,
          script: set.script,
          setTitle: set.title,
        };
      }
    }
    return null;
  }

  return null;
}
