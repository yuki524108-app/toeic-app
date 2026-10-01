#!/usr/bin/env python3
"""ChatGPTの結果(results/result_XX.json)を検証して src/data/words.json に反映する。

使い方:  python tools/words/import_results.py [--dry-run]
- 単語1件ずつ判定し、問題のない単語だけ反映する（一部だけ変な出力でもチャンク全体は捨てない）。
- 何度実行してもOK（同じidは上書き）。
"""
import json, re, sys, glob, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'gemini'))
from common import load_result, has_ja  # tools/gemini/common.py の頑丈なJSONパーサを共用

HERE = os.path.dirname(os.path.abspath(__file__))
WORDS = os.path.join(HERE, '..', '..', 'src', 'data', 'words.json')
DRY = '--dry-run' in sys.argv

def check_item(r):
    errs = []
    for k in ('pos', 'exampleJa', 'note'):
        if not isinstance(r.get(k), str):
            errs.append(f'{k} がありません')
    if isinstance(r.get('exampleJa'), str) and not has_ja(r['exampleJa']):
        errs.append('exampleJa に日本語がありません')
    if isinstance(r.get('pos'), str) and (not r['pos'] or not has_ja(r['pos'])):
        errs.append('pos が空/日本語でない')
    if isinstance(r.get('note'), str) and r['note'].count('\n') > 2:
        errs.append('note が4行以上')
    return errs

def main():
    words = json.load(open(WORDS, encoding='utf-8'))
    by_id = {w['id']: w for w in words}
    applied = skipped = 0
    todo_ids = []
    for rp in sorted(glob.glob(os.path.join(HERE, 'results', 'result_*.json'))):
        n = re.search(r'result_(\d+)', rp).group(1)
        cp = os.path.join(HERE, 'chunks', f'chunk_{n}.json')
        if not os.path.exists(cp):
            print(f'[{n}] 対応するチャンクがありません'); continue
        chunk = json.load(open(cp, encoding='utf-8'))
        try:
            result = load_result(rp)
            assert isinstance(result, list)
        except Exception as e:
            print(f'[{n}] チャンク全体がJSONとして読めません: {e} — 再生成してください')
            todo_ids.extend(c['id'] for c in chunk)
            continue
        by_result = {r.get('id'): r for r in result if isinstance(r, dict)}
        chunk_ok = 0
        for c in chunk:
            r = by_result.get(c['id'])
            if r is None:
                print(f"[{n}] {c['id']}: 出力に見つかりません")
                skipped += 1; todo_ids.append(c['id']); continue
            errs = check_item(r)
            if errs:
                print(f"[{n}] {c['id']}: NG — " + " / ".join(errs))
                skipped += 1; todo_ids.append(c['id']); continue
            w = by_id[c['id']]
            w['pos'] = r['pos'].strip()
            w['exampleJa'] = r['exampleJa'].strip()
            if r['note'].strip():
                w['note'] = r['note'].strip()
            else:
                w.pop('note', None)
            applied += 1
            chunk_ok += 1
        print(f'[{n}] {chunk_ok}/{len(chunk)}語 反映')
    done = sum(1 for w in words if 'exampleJa' in w)
    print(f'\n反映: {applied}語 / 見送り: {skipped}語')
    if todo_ids:
        print('要再生成のid:', ', '.join(todo_ids))
    print(f'詳細解説つき単語: {done}/{len(words)}')
    if not DRY and applied:
        json.dump(words, open(WORDS, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('words.json を更新しました')
    elif DRY:
        print('(dry-run: 書き込みなし)')

if __name__ == '__main__':
    main()
