#!/usr/bin/env python3
"""supplement/passages_*.json の passage2Ja / passage3Ja を readings.json に反映する。

Gemini の結果に含まれていなかった、複数文書セットの2つ目・3つ目の全訳を補うためのもの。
すでに入っている値は上書きしない（--force で上書き）。
使い方:  python3 tools/gemini/reading/apply_supplement.py [--dry-run] [--force]
"""
import glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', '..', 'src', 'data', 'readings.json')
DRY, FORCE = '--dry-run' in sys.argv, '--force' in sys.argv


def main():
    data = json.load(open(DATA, encoding='utf-8'))
    by_id = {x['id']: x for x in data}
    added, problems = 0, []
    for p in sorted(glob.glob(os.path.join(HERE, 'supplement', 'passages_*.json'))):
        for rid, fields in json.load(open(p, encoding='utf-8')).items():
            x = by_id.get(rid)
            if x is None:
                problems.append(f'{rid}: 文書が見つかりません')
                continue
            for key, src in (('passage2Ja', 'passage2'), ('passage3Ja', 'passage3')):
                if key not in fields:
                    continue
                if not x.get(src):
                    problems.append(f'{rid}: {src} がないのに {key} がある')
                elif not fields[key].strip():
                    problems.append(f'{rid}: {key} が空')
                elif FORCE or not x.get(key):
                    x[key] = fields[key]
                    added += 1
    # 抜けの確認
    for x in data:
        for key, src in (('passage2Ja', 'passage2'), ('passage3Ja', 'passage3')):
            if x.get(src) and not x.get(key):
                problems.append(f"{x['id']}: {key} が未反映")
    print(f'反映: {added}件 / 問題: {len(problems)}件')
    for m in problems:
        print('  ', m)
    if not DRY:
        json.dump(data, open(DATA, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print('readings.json を更新しました')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
