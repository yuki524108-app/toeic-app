#!/usr/bin/env python3
"""Geminiの結果(results/result_XX.json)を検証して src/data/part6.json に反映する。

使い方:  python tools/gemini/part6/import_results.py [--dry-run]
"""
import json, re, sys, glob, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from common import load_result, has_ja

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, '..', '..', '..', 'src', 'data', 'part6.json')
DRY = '--dry-run' in sys.argv

def validate(chunk, result):
    errs = []
    if not isinstance(result, list):
        return ['JSON配列ではありません']
    if len(result) != len(chunk):
        errs.append(f'件数不一致: 入力{len(chunk)} / 出力{len(result)}')
    by_id = {r.get('id'): r for r in result if isinstance(r, dict)}
    for c in chunk:
        r = by_id.get(c['id'])
        if r is None:
            errs.append(f"{c['id']}: 出力に見つかりません"); continue
        if not has_ja(r.get('passageJa')):
            errs.append(f"{c['id']}: passageJa に日本語がありません")
        if not isinstance(r.get('vocab'), list) or not r['vocab']:
            errs.append(f"{c['id']}: vocab がありません")
        bl_in = {b['id']: b for b in c['blanks']}
        bl_out = {b.get('id'): b for b in r.get('blanks', []) if isinstance(b, dict)}
        for bid, b in bl_in.items():
            bo = bl_out.get(bid)
            if bo is None:
                errs.append(f"{bid}: 空欄の出力がありません"); continue
            cj = bo.get('choicesJa')
            if not isinstance(cj, list) or len(cj) != len(b['choices']):
                errs.append(f"{bid}: choicesJa の数が選択肢({len(b['choices'])})と不一致")
            if not has_ja(bo.get('explanationDetail')):
                errs.append(f"{bid}: explanationDetail に日本語がありません")
    return errs

def main():
    data = json.load(open(TARGET, encoding='utf-8'))
    by_id = {x['id']: x for x in data}
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
            print(f'[{n}] NG（{len(errs)}件）— 再生成してください')
            [print('   -', e) for e in errs[:10]]
            skipped += 1; continue
        by_result = {r['id']: r for r in result}
        for c in chunk:
            r = by_result[c['id']]
            x = by_id[c['id']]
            x['passageJa'] = r['passageJa']
            x['vocab'] = r['vocab']
            bmap = {b['id']: b for b in r['blanks']}
            for b in x['blanks']:
                rb = bmap.get(b['id'])
                if not rb: continue
                b['choicesJa'] = rb['choicesJa']
                b['explanationDetail'] = rb['explanationDetail']
        print(f'[{n}] OK  {len(result)}文書')
        applied += 1
    done = sum(1 for x in data if 'passageJa' in x)
    print(f'\n反映チャンク: {applied} / スキップ: {skipped} / 詳細解説つき文書: {done}/{len(data)}')
    if not DRY and applied:
        json.dump(data, open(TARGET, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('part6.json を更新しました')
    elif DRY:
        print('(dry-run: 書き込みなし)')

if __name__ == '__main__':
    main()
