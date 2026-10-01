#!/usr/bin/env python3
"""Geminiの結果(results/result_XX.json)を検証して src/data/readings.json に反映する。

文書（passage）単位で判定する:
  - 致命的な不備（passageJaが無い・設問の訳が無い等）がある文書はスキップ
  - passage2Ja/passage3Ja だけが無い場合は「注意」として、他のデータは反映する
    （複数パッセージものだけ追加で作り直せばよい）

使い方:  python tools/gemini/reading/import_results.py [--dry-run]
"""
import json, re, sys, glob, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from common import load_result, has_ja

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, '..', '..', '..', 'src', 'data', 'readings.json')
DRY = '--dry-run' in sys.argv

def check_item(c, r):
    errs, warns = [], []
    if r is None:
        return ([f"{c['id']}: 出力に見つかりません"], [])
    if not has_ja(r.get('passageJa')):
        errs.append(f"{c['id']}: passageJa に日本語がありません")
    if c.get('passage2') and not has_ja(r.get('passage2Ja')):
        warns.append(f"{c['id']}: passage2Ja が未対応")
    if c.get('passage3') and not has_ja(r.get('passage3Ja')):
        warns.append(f"{c['id']}: passage3Ja が未対応")
    if not isinstance(r.get('vocab'), list) or not r['vocab']:
        warns.append(f"{c['id']}: vocab がありません")
    qs_out = {q.get('id'): q for q in r.get('questions', []) if isinstance(q, dict)}
    for q in c['questions']:
        qo = qs_out.get(q['id'])
        if qo is None:
            errs.append(f"{q['id']}: 設問の出力がありません"); continue
        if not has_ja(qo.get('questionJa')):
            errs.append(f"{q['id']}: questionJa に日本語がありません")
        cj = qo.get('choicesJa')
        if not isinstance(cj, list) or len(cj) != len(q['choices']):
            errs.append(f"{q['id']}: choicesJa の数が選択肢({len(q['choices'])})と不一致")
        if not has_ja(qo.get('explanationDetail')):
            errs.append(f"{q['id']}: explanationDetail に日本語がありません")
    return errs, warns

def apply_item(c, r, by_id):
    x = by_id[c['id']]
    x['passageJa'] = r['passageJa']
    if has_ja(r.get('passage2Ja')): x['passage2Ja'] = r['passage2Ja']
    if has_ja(r.get('passage3Ja')): x['passage3Ja'] = r['passage3Ja']
    if r.get('vocab'): x['vocab'] = r['vocab']
    qmap = {q['id']: q for q in r.get('questions', [])}
    for q in x['questions']:
        rq = qmap.get(q['id'])
        if not rq: continue
        q['questionJa'] = rq['questionJa']
        q['choicesJa'] = rq['choicesJa']
        q['explanationDetail'] = rq['explanationDetail']

def main():
    data = json.load(open(TARGET, encoding='utf-8'))
    by_id = {x['id']: x for x in data}
    applied = applied_with_warning = skipped_items = unreadable_chunks = 0
    todo_ids = []
    for rp in sorted(glob.glob(os.path.join(HERE, 'results', 'result_*.json'))):
        n = re.search(r'result_(\d+)', rp).group(1)
        cp = os.path.join(HERE, 'chunks', f'chunk_{n}.json')
        if not os.path.exists(cp):
            print(f'[{n}] 対応するチャンクがありません'); unreadable_chunks += 1; continue
        chunk = json.load(open(cp, encoding='utf-8'))
        try:
            result = load_result(rp)
            assert isinstance(result, list)
        except Exception as e:
            print(f'[{n}] チャンク全体がJSONとして読めません: {e} — 再生成してください')
            unreadable_chunks += 1
            todo_ids.extend(c['id'] for c in chunk)
            continue
        by_result = {r.get('id'): r for r in result if isinstance(r, dict)}
        chunk_warns = []
        chunk_ok = True
        for c in chunk:
            r = by_result.get(c['id'])
            errs, warns = check_item(c, r)
            if errs:
                print(f"[{n}] {c['id']}: NG — " + " / ".join(errs[:3]))
                skipped_items += 1
                todo_ids.append(c['id'])
                chunk_ok = False
                continue
            apply_item(c, r, by_id)
            if warns:
                applied_with_warning += 1
                chunk_warns.extend(warns)
            else:
                applied += 1
        if chunk_warns:
            print(f'[{n}] 反映（一部注意あり）: ' + ' / '.join(chunk_warns))
        elif chunk_ok:
            print(f'[{n}] OK  {len(chunk)}文書')
    done = sum(1 for x in data if 'passageJa' in x)
    print(f'\n反映: {applied}文書（完全）+ {applied_with_warning}文書（一部注意）'
          f' / 見送り: {skipped_items}文書 / 読めなかったチャンク: {unreadable_chunks}')
    if todo_ids:
        print('要再生成のid:', ', '.join(todo_ids))
    print(f'詳細解説つき文書: {done}/{len(data)}')
    if not DRY and (applied or applied_with_warning):
        json.dump(data, open(TARGET, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('readings.json を更新しました')
    elif DRY:
        print('(dry-run: 書き込みなし)')

if __name__ == '__main__':
    main()
