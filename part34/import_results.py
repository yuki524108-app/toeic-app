#!/usr/bin/env python3
"""Geminiの結果(results/result_XX.json)を検証して src/data/listeningPart34.json に反映する。

使い方:  python tools/gemini/part34/import_results.py [--dry-run]
"""
import json, re, sys, glob, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from common import load_result, has_ja

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, '..', '..', '..', 'src', 'data', 'listeningPart34.json')
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
        sj = r.get('scriptJa')
        if not isinstance(sj, list) or len(sj) != len(c['script']):
            errs.append(f"{c['id']}: scriptJa の行数が script({len(c['script'])})と不一致")
        elif not all(has_ja(s) for s in sj):
            errs.append(f"{c['id']}: scriptJa に日本語でない行があります")
        if not isinstance(r.get('vocab'), list) or not r['vocab']:
            errs.append(f"{c['id']}: vocab がありません")
        qs_in = {q['id']: q for q in c['questions']}
        qs_out = {q.get('id'): q for q in r.get('questions', []) if isinstance(q, dict)}
        for qid, q in qs_in.items():
            qo = qs_out.get(qid)
            if qo is None:
                errs.append(f"{qid}: 設問の出力がありません"); continue
            if not has_ja(qo.get('questionJa')):
                errs.append(f"{qid}: questionJa に日本語がありません")
            cj = qo.get('choicesJa')
            if not isinstance(cj, list) or len(cj) != len(q['choices']):
                errs.append(f"{qid}: choicesJa の数が選択肢({len(q['choices'])})と不一致")
            if not has_ja(qo.get('explanationDetail')):
                errs.append(f"{qid}: explanationDetail に日本語がありません")
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
            x['scriptJa'] = r['scriptJa']
            x['vocab'] = r['vocab']
            qmap = {q['id']: q for q in r['questions']}
            for q in x['questions']:
                rq = qmap.get(q['id'])
                if not rq: continue
                q['questionJa'] = rq['questionJa']
                q['choicesJa'] = rq['choicesJa']
                q['explanationDetail'] = rq['explanationDetail']
        print(f'[{n}] OK  {len(result)}セット')
        applied += 1
    done = sum(1 for x in data if 'scriptJa' in x)
    print(f'\n反映チャンク: {applied} / スキップ: {skipped} / 詳細解説つきセット: {done}/{len(data)}')
    if not DRY and applied:
        json.dump(data, open(TARGET, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('listeningPart34.json を更新しました')
    elif DRY:
        print('(dry-run: 書き込みなし)')

if __name__ == '__main__':
    main()
