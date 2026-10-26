#!/usr/bin/env python3
"""選択肢の並び替え（rebalance_choices.py）に追従していなかった choicesJa／解説中の記号を直す（1回限り）。

背景:
  Gemini には並び替え前の選択肢（tools/gemini/*/chunks/*.json の順）で渡して訳を作った。
  その後 rebalance_choices.py が choices と answer だけを並べ替えたため、
  choicesJa は英語の choices と順番がずれ、explanationDetail の「(B)」「選択肢C」も
  並び替え前の記号のままになっていた。
  チャンクの順を「Gemini が見た元の順」として、現在の choices の順に合わせて直す。

使い方:  python3 tools/fix_choicesja_order.py [--dry-run]
  * 1回限り。実行後は tools/.choicesja_order_fixed を作り、再実行を拒否する
    （再実行すると、すでに直したものをもう一度並べ替えてしまうため）。
  * 新しく Gemini の結果を取り込む場合は、その分のチャンクを「並べ替え前の順」のまま保存し、
    取り込み後に python3 tools/gemini/<分野>/import_results.py → rebalance_choices.py を
    実行した場合は、この修正を再度かける必要がある（README参照）。
"""
import json, glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DRY = '--dry-run' in sys.argv
MARK = os.path.join(ROOT, 'tools', '.choicesja_order_fixed')
LETTERS = 'ABCD'

SETS = [
    ('読解', 'src/data/readings.json', 'tools/gemini/reading/chunks', 'questions'),
    ('Part 6', 'src/data/part6.json', 'tools/gemini/part6/chunks', 'blanks'),
    ('Part 3・4', 'src/data/listeningPart34.json', 'tools/gemini/part34/chunks', 'questions'),
]
# 記号の書き方（解説に出てくるもの）。英文の引用中の "A" などは対象にしない。
RE_SENTAKUSHI = re.compile(r'選択肢([A-D])')
RE_PAREN = re.compile(r'([(（])([A-D])([)）])')
# 「正解の記号」を示す定型表現（検証用）
RE_ANSWER = [re.compile(r'選択肢([A-D])[）)]?が正解'), re.compile(r'[(（]([A-D])[)）][^、。]{0,40}が正解')]


def perm_for(orig, cur):
    """orig[i] が cur のどこにあるか（重複する文字列にも対応）。"""
    used, perm = set(), []
    for t in orig:
        j = next((k for k, c in enumerate(cur) if c == t and k not in used), None)
        if j is None:
            return None
        used.add(j); perm.append(j)
    return perm


def remap_letters(text, perm):
    f = lambda i: LETTERS[perm[LETTERS.index(i)]] if LETTERS.index(i) < len(perm) else i
    text = RE_SENTAKUSHI.sub(lambda m: '選択肢' + f(m.group(1)), text)
    return RE_PAREN.sub(lambda m: m.group(1) + f(m.group(2)) + m.group(3), text)


def answer_letter(text):
    for r in RE_ANSWER:
        m = r.search(text)
        if m:
            return m.group(1)
    return None


def main():
    if os.path.exists(MARK) and not DRY:
        sys.exit('すでに実行済みです（tools/.choicesja_order_fixed がある）。再実行すると二重に並べ替えてしまうため中止します。')
    for label, data_path, chunk_dir, sub in SETS:
        path = os.path.join(ROOT, data_path)
        data = json.load(open(path, encoding='utf-8'))
        by_id = {x['id']: x for x in data}
        orig = {}
        for cp in sorted(glob.glob(os.path.join(ROOT, chunk_dir, 'chunk_[0-9][0-9].json'))):
            for c in json.load(open(cp, encoding='utf-8')):
                for q in c[sub]:
                    orig[q['id']] = q['choices']
        fixed = same = skipped = 0
        ok_before = ok_after = n_checked = 0
        for x in data:
            for q in x[sub]:
                cj = q.get('choicesJa')
                if not cj or q['id'] not in orig:
                    continue
                o, cur = orig[q['id']], q['choices']
                perm = perm_for(o, cur)
                if perm is None or len(cj) != len(cur):
                    skipped += 1
                    print(f"  [{label}] {q['id']}: 選択肢の中身が一致せず、見送り")
                    continue
                ex = q.get('explanationDetail', '')
                new_ex = remap_letters(ex, perm)
                la = answer_letter(ex)
                if la is not None:
                    n_checked += 1
                    ok_before += LETTERS.index(la) == q['answer']
                    lb = answer_letter(new_ex)
                    ok_after += lb is not None and LETTERS.index(lb) == q['answer']
                if perm == list(range(len(cur))):
                    same += 1
                    continue
                new_cj = [None] * len(cj)
                for i, j in enumerate(perm):
                    new_cj[j] = cj[i]
                q['choicesJa'] = new_cj
                q['explanationDetail'] = new_ex
                fixed += 1
        print(f'{label}: 並べ替え {fixed}問 / 元から同じ順 {same}問 / 見送り {skipped}問'
              f' / 解説の正解記号の照合 {n_checked}問: 修正前 {ok_before}一致 → 修正後 {ok_after}一致')
        if not DRY:
            json.dump(data, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    if DRY:
        print('(dry-run: 書き込みなし)')
    else:
        open(MARK, 'w').write('done\n')
        print('完了')


if __name__ == '__main__':
    main()
