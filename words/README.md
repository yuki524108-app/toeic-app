# 単語の詳細解説（ChatGPT連携）

1. `PROMPT.md` の【指示文】をChatGPTに貼る
2. `chunks/chunk_01.json` の中身を貼る → 返ってきたJSONを `results/result_01.json` に保存
3. 同じチャットで chunk_02, 03, … を繰り返す（全20チャンク、各100語）
4. `python tools/words/import_results.py --dry-run` で検証 → 問題なければ `--dry-run` を外して反映
   - 単語1つずつ判定するので、チャンクの一部だけおかしくても使える分はちゃんと反映されます
   - NGだった単語のidが最後に一覧で出るので、そのidだけ该当チャンクで再生成すればOK
   - 途中まででも反映できます（何度実行してもOK）

## 現在の状況（2025年9月時点）
1,900/2,000語を反映済み。残り **chunk_18（w1701〜w1800の100語）が未反映**です
（`results/result_18.json` に別チャンクの内容が誤って保存されていたため、中身が空のまま）。
`chunks/chunk_18.json` をChatGPTにもう一度貼って結果を取り直してください。

