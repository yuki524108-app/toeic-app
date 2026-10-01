import json, re, os

JA = re.compile(r'[\u3040-\u30ff\u4e00-\u9fff]')

def strip_code_fence(txt):
    return re.sub(r'^```(?:json|python)?\s*|\s*```\s*$', '', txt.strip())

def _iter_json_blocks(text):
    """Yield every top-level JSON array/object substring found in `text`,
    scanning past non-JSON content (prose, code) in between."""
    i = 0
    n = len(text)
    while i < n:
        start = None
        for j in range(i, n):
            if text[j] in '[{':
                start = j
                open_ch = text[j]
                break
        if start is None:
            return
        close_ch = ']' if open_ch == '[' else '}'
        depth = 0
        in_str = False
        esc = False
        end = None
        for k in range(start, n):
            ch = text[k]
            if in_str:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch in '[{':
                depth += 1
            elif ch in ']}':
                depth -= 1
                if depth == 0:
                    end = k
                    break
        if end is None:
            return  # unbalanced tail; nothing more usable
        yield text[start:end + 1]
        i = end + 1

_RESULT_MARKERS = ('Ja"', 'explanationDetail', 'choicesJa', 'passageJa', 'scriptJa', 'questionJa')

def extract_json_block(text):
    """Kept for backward-compat: returns the first top-level JSON block."""
    for block in _iter_json_blocks(text):
        return block
    raise ValueError('JSON配列/オブジェクトの開始が見つかりません')

def _repair_unescaped_quotes(s):
    """Best-effort fix for a common LLM mistake: literal "quoted phrases"
    embedded inside a JSON string value, left unescaped. Walks the text
    tracking whether each double-quote plausibly ends the JSON string
    (next non-space char is , : } ]  or end of text) vs. is just an
    embedded quote (escape it and keep going)."""
    out = []
    i = 0
    n = len(s)
    in_str = False
    esc = False
    while i < n:
        ch = s[i]
        if not in_str:
            out.append(ch)
            if ch == '"':
                in_str = True
            i += 1
            continue
        if esc:
            out.append(ch)
            esc = False
            i += 1
            continue
        if ch == '\\':
            out.append(ch)
            esc = True
            i += 1
            continue
        if ch == '"':
            j = i + 1
            while j < n and s[j] in ' \t\r\n':
                j += 1
            if j >= n or s[j] in ',:}]':
                out.append(ch)  # genuine end of string
                in_str = False
            else:
                out.append('\\"')  # embedded quote; escape and continue
            i += 1
            continue
        out.append(ch)
        i += 1
    return ''.join(out)

CITE_RE = re.compile(r'\s*\[\s*[Cc]ite\s*:?[^\]]*\]')

def clean_text(s):
    if not isinstance(s, str):
        return s
    return CITE_RE.sub('', s)

def clean_result(obj):
    """Recursively strip citation-marker noise like '[cite: 4]' that some
    models leave inline in generated Japanese text."""
    if isinstance(obj, str):
        return clean_text(obj)
    if isinstance(obj, list):
        return [clean_result(x) for x in obj]
    if isinstance(obj, dict):
        return {k: clean_result(v) for k, v in obj.items()}
    return obj

def load_result(path):
    raw = open(path, encoding='utf-8-sig').read()
    txt = strip_code_fence(raw)
    candidates = []
    for block in _iter_json_blocks(txt):
        try:
            candidates.append((block, json.loads(block)))
        except json.JSONDecodeError:
            try:
                candidates.append((block, json.loads(_repair_unescaped_quotes(block))))
            except json.JSONDecodeError:
                continue
    if not candidates:
        # last attempt: whole stripped text as-is (gives a clean error message)
        return clean_result(json.loads(txt))
    # Prefer candidates that actually look like our expected translated output
    # (some models echo the original untranslated input as an earlier block,
    # e.g. wrapped as a Python `data = [...]` snippet, before the real answer).
    scored = [(sum(block.count(m) for m in _RESULT_MARKERS), idx, val)
              for idx, (block, val) in enumerate(candidates)]
    scored.sort(key=lambda t: (t[0], t[1]))
    return clean_result(scored[-1][2])



def has_ja(s):
    return isinstance(s, str) and bool(JA.search(s))
