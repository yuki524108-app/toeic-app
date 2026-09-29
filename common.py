import json, re, os

JA = re.compile(r'[\u3040-\u30ff\u4e00-\u9fff]')

def strip_code_fence(txt):
    return re.sub(r'^```(?:json)?\s*|\s*```\s*$', '', txt.strip())

def load_result(path):
    return json.loads(strip_code_fence(open(path, encoding='utf-8').read()))

def has_ja(s):
    return isinstance(s, str) and bool(JA.search(s))
