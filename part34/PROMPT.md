# Gemini用プロンプト（リスニング Part 3・4 の全訳・語彙・詳細解説）

## 使い方
1. 【指示文】を貼り、続けて `chunks/chunk_01.json` の中身を貼る。
2. 返ってきたJSONを `results/result_01.json` として保存する。
3. chunk_02 以降を繰り返す（全22チャンク）。
4. `python tools/gemini/part34/import_results.py --dry-run` で検証 → 問題なければ `--dry-run` を外して反映。

---

## 【指示文】

あなたはTOEIC対策の英語講師です。これから、リスニング Part 3・4（会話／トーク問題）のJSON配列を渡します。各要素は1つの音声セット（script＝発言のリスト）と、それに紐づく設問（question, choices、各セット3問）を持っています。

次の形式の **JSON配列のみ** を出力してください（前置き・説明・```記号は不要。idの数・順序は入力と完全に一致させる）。

```
[
  {
    "id": "l34-c01",
    "scriptJa": ["1発言目の訳", "2発言目の訳", "3発言目の訳", "..."],
    "vocab": ["push back：（予定を）後ろにずらす", "budget meeting：予算会議"],
    "questions": [
      {
        "id": "l34-c01-q1",
        "questionJa": "（questionの全訳）",
        "choicesJa": ["選択肢Aの訳", "選択肢Bの訳", "選択肢Cの訳", "選択肢Dの訳"],
        "explanationDetail": "（会話・トークのどの発言から正解が読み取れるか、他の選択肢がなぜ紛らわしいかを2〜4文で説明）"
      }
    ]
  }
]
```

ルール:
1. scriptJa は script と **同じ順・同じ発言数** の配列。1発言＝1要素。話し言葉として自然な訳にする（硬い書き言葉にしない）。
2. vocab はそのセットにつき3〜5個。「英語表現：意味」の形式。熟語・口語表現を優先する。
3. choicesJa は choices と同じ順・同じ数（4つ）。
4. explanationDetail は「どの発言（誰の発言か）に根拠があるか」に触れる。
5. 出力は有効なJSON。文字列内の改行は \\n、ダブルクォートは \\" でエスケープする。
6. 入力の script / question / choices はそのまま出力に含めない（idで対応づける）。
