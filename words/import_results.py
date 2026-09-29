#!/usr/bin/env python3
"""ChatGPTの結果(results/result_XX.json)を検証して src/data/words.json に反映する。

使い方:  python tools/words/import_results.py [--dry-run]
- 各チャンクごとに検証し、OKなチャンクだけ反映。NGは理由を表示してスキップ（再生成すればよい）。
- 何度実行してもOK（同じidは上書き）。
"""
import json, re, sys, glob, os

HERE = os.path.dirname(os.path.abspath(__file__))
WORDS = os.path.join(HERE, '..', '..', 'src', 'data', 'words.json')
DRY = '--dry-run' in sys.argv
JA = re.compile(r'[\u3040-\u30ff\u4e00-\u9fff]')

def load_result(path):
    txt = open(path, encoding='utf-8').read().strip()
    txt = re.sub(r'^```(?:json)?\s*|\s*```$', '', txt)  # コードブロック記号を許容
    return json.loads(txt)

def validate(chunk, result):
    errs = []
    if not isinstance(result, list): return ['JSON配列ではありません']
    if len(result) != len(chunk): errs.append(f'件数不一致: 入力{len(chunk)} / 出力{len(result)}')
    ids_in = [c['id'] for c in chunk]
    ids_out = [r.get('id') for r in result]
    if ids_in != ids_out:
        miss = [i for i in ids_in if i not in ids_out]
        errs.append(f'idの並び・内容が入力と違います（欠落: {miss[:5]}）')
    for r in result:
        i = r.get('id')
        for k in ('pos', 'exampleJa', 'note'):
            if not isinstance(r.get(k), str): errs.append(f'{i}: {k} がありません')
        if isinstance(r.get('exampleJa'), str) and not JA.search(r['exampleJa']): errs.append(f'{i}: exampleJa に日本語がありません')
        if isinstance(r.get('pos'), str) and (not r['pos'] or not JA.search(r['pos'])): errs.append(f'{i}: pos が空/日本語でない')
        if isinstance(r.get('note'), str) and r['note'].count('\n') > 2: errs.append(f'{i}: note が4行以上')
    return errs

def main():
    words = json.load(open(WORDS, encoding='utf-8'))
    by_id = {w['id']: w for w in words}
    applied = skipped = 0
    for rp in sorted(glob.glob(os.path.join(HERE, 'results', 'result_*.json'))):
        n = re.search(r'result_(\d+)', rp).group(1)
        cp = os.path.join(HERE, 'chunks', f'chunk_{n}.json')
        if not os.path.exists(cp):
            print(f'[{n}] 対応するチャンクがありません'); skipped += 1; continue
        chunk = json.load(open(cp, encoding='utf-8'))
        try:
            result = load_result(rp)
        except Exception as e:
            print(f'[{n}] JSONとして読めません: {e}'); skipped += 1; continue
        errs = validate(chunk, result)
        if errs:
            print(f'[{n}] NG（{len(errs)}件）— 再生成してください'); [print('   -', e) for e in errs[:8]]; skipped += 1; continue
        for r in result:
            w = by_id[r['id']]
            w['pos'] = r['pos'].strip(); w['exampleJa'] = r['exampleJa'].strip()
            if r['note'].strip(): w['note'] = r['note'].strip()
            else: w.pop('note', None)
        print(f'[{n}] OK  {len(result)}語'); applied += 1
    done = sum(1 for w in words if 'exampleJa' in w)
    print(f'\n反映チャンク: {applied} / スキップ: {skipped} / 詳細解説つき単語: {done}/{len(words)}')
    if not DRY and applied:
        json.dump(words, open(WORDS, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('words.json を更新しました')
    elif DRY: print('(dry-run: 書き込みなし)')

if __name__ == '__main__': main()
