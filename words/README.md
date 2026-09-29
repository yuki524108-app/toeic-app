# 単語の詳細解説（ChatGPT連携）

1. `PROMPT.md` の【指示文】をChatGPTに貼る
2. `chunks/chunk_01.json` の中身を貼る → 返ってきたJSONを `results/result_01.json` に保存
3. 同じチャットで chunk_02, 03, … を繰り返す（全20チャンク、各100語）
4. `python tools/words/import_results.py --dry-run` で検証 → 問題なければ `--dry-run` を外して反映
   - NGのチャンクは理由が表示されるので、そのチャンクだけ再生成
   - 途中まででも反映できます（何度実行してもOK）
