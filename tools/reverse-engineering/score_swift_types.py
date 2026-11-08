#!/usr/bin/env python3
"""
Scores Swift type recovery (REA's, or swift_model.py's) against a project's source.

REA's analyze_swift_types reports procedure symbols grouped by the kind of
their outermost nominal type, but leaves the names mangled. This script
decodes just enough of Swift's mangling (module, nested nominal types, word
substitutions, file-private discriminators, legacy _Tt ObjC names) to list
the types each symbol belongs to, then compares that list with the type
declarations found in the source tree.

    python3 swift_declarations.py src/App src/Core --json declared.json
    python3 score_swift_types.py --declared declared.json --rea swift.json --model model.json --modules App Core

Types are compared by fully qualified name (A.Row and B.Row are two types),
with bare-name recall alongside for comparison.
"""
import json
import re
import sys

KINDS = {'V': 'struct', 'C': 'class', 'O': 'enum', 'P': 'protocol', 'a': 'typealias'}


class Mangled:
    def __init__(self, text):
        self.t = text
        self.i = 0
        self.words = []

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else ''

    def natural(self):
        m = re.match(r'\d+', self.t[self.i:])
        if not m:
            return None
        self.i += len(m.group(0))
        return int(m.group(0))

    def add_words(self, chunk):
        start = -1
        for idx in range(len(chunk) + 1):
            c = chunk[idx] if idx < len(chunk) else '\0'
            if start >= 0:
                prev = chunk[idx - 1]
                end = c in '_\0' or (not prev.isupper() and c.isupper())
                if end:
                    if idx - start >= 2 and len(self.words) < 26:
                        self.words.append(chunk[start:idx])
                    start = -1
            if start < 0 and not c.isdigit() and c not in '_\0':
                start = idx

    def identifier(self):
        """Swift 5 identifier with word substitutions (no punycode)."""
        c = self.peek()
        if not c.isdigit():
            return None
        subst = False
        if c == '0':
            self.i += 1
            if self.peek() == '0':
                return None  # punycode: not needed for this project
            subst = True
        out = ''
        while True:
            while subst and self.peek().isalpha():
                ch = self.t[self.i]
                self.i += 1
                idx = ord(ch.lower()) - ord('a')
                if idx >= len(self.words):
                    return None
                out += self.words[idx]
                if ch.isupper():
                    subst = False
            if self.peek() == '0' and not out == '':
                self.i += 1
                break
            n = self.natural()
            if not n or self.i + n > len(self.t):
                return None
            chunk = self.t[self.i:self.i + n]
            self.i += n
            out += chunk
            self.add_words(chunk)
            if not subst:
                break
        return out


def nominal_chain(symbol):
    """['Salty', ('struct', 'RecipeDetailView'), ...] for a symbol, or None."""
    symbol = symbol.split('::')[0]
    legacy = re.match(r'_{1,2}Tt([CVO]+)(.*)$', symbol)
    s = symbol[1:] if symbol.startswith('_') else symbol
    if legacy:
        kinds = legacy.group(1)[::-1]
        rest = legacy.group(2)
        m = Mangled(rest)
        module = m.identifier()
        chain = []
        for k in kinds:
            if m.t[m.i:m.i + 4] == 'P33_':  # old-style private discriminator
                m.i += 1
                m.identifier()
            name = m.identifier()
            if not name:
                break
            chain.append((KINDS[k], name))
        return [module, *chain] if module and chain else None
    if not (s.startswith('$s') or s.startswith('$S')):
        return None
    m = Mangled(s[2:])
    module = m.identifier()
    if not module:
        return None
    chain = []
    while True:
        save = m.i
        name = m.identifier()
        if not name:
            m.i = save
            break
        # file-private: <name> <discriminator> LL
        if m.t[m.i:m.i + 3] == '33_':
            m.identifier()
            if m.t[m.i:m.i + 2] != 'LL':
                break
            m.i += 2
        k = m.peek()
        if k not in KINDS:
            break
        m.i += 1
        chain.append((KINDS[k], name))
    return [module, *chain] if chain else None


def selftest():
    assert nominal_chain('_$s5Salty16RecipeDetailViewV4bodyQrvg') == ['Salty', ('struct', 'RecipeDetailView')]
    assert nominal_chain('_$s5Salty0A11SyncServiceC5startyyF') == ['Salty', ('class', 'SaltySyncService')]
    assert nominal_chain('_TtCV5Maccy13LargeTextView11EditorState::dealloc') == ['Maccy', ('struct', 'LargeTextView'), ('class', 'EditorState')]
    assert nominal_chain('_$s5Salty8ChefViewV0C3RowV') == ['Salty', ('struct', 'ChefView'), ('struct', 'ViewRow')]
    assert nominal_chain('_$s5Salty7Helpers33_0123456789ABCDEF0123456789ABCDEFLLV1xSivg') == ['Salty', ('struct', 'Helpers')]
    assert nominal_chain('_$s10AppIntents12IntentDialogVMa') == ['AppIntents', ('struct', 'IntentDialog')]


def rea_types(swift_path, modules):
    """Qualified type names (with kinds) REA's analyze_swift_types symbols reveal in `modules`."""
    data = json.load(open(swift_path))
    sc = data.get('structuredContent') or json.loads(data['content'][0]['text'])
    result = sc['normalized_result']
    symbols = [it['name'] for cat in result['categories'].values() for it in cat['items']]
    symbols += [it['name'] for it in result.get('unclassified', [])]
    recovered, undecoded = {}, 0
    for sym in symbols:
        chain = nominal_chain(sym.split('::')[0])
        if not chain:
            undecoded += 1
            continue
        module, *types = chain
        if module in modules:
            for depth in range(1, len(types) + 1):
                recovered.setdefault('.'.join(name for _kind, name in types[:depth]), types[depth - 1][0])
    print(f'{len(symbols)} symbols from REA; {undecoded} without a decodable nominal context')
    return recovered


def model_types(model_path, modules):
    """Qualified type names (with kinds) from swift_model.py's JSON output."""
    return {t['name']: t['kind'] for t in json.load(open(model_path)) if t['module'] in modules}


def score(declared, recovered):
    """Recall by fully qualified name, and by bare name (the last component) for comparison."""
    found = sorted(n for n in declared if n in recovered)
    right_kind = [n for n in found if recovered[n] == declared[n] or (declared[n] == 'actor' and recovered[n] == 'class')]
    bare_declared = {n.rsplit('.', 1)[-1] for n in declared}
    bare_recovered = {n.rsplit('.', 1)[-1] for n in recovered}
    bare_found = bare_declared & bare_recovered
    return {
        'declared': len(declared),
        'recovered': len(found),
        'recall': round(len(found) / len(declared), 3) if declared else 0,
        'kind_correct': len(right_kind),
        'bare_declared': len(bare_declared),
        'bare_recovered': len(bare_found),
        'missed': sorted(set(declared) - set(found)),
    }


def main():
    selftest()
    import argparse

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--declared', required=True, help='JSON from swift_declarations.py (qualified name -> kind)')
    ap.add_argument('--rea', help="REA analyze_swift_types output (JSON)")
    ap.add_argument('--model', help='swift_model.py --json output')
    ap.add_argument('--modules', nargs='+', required=True, help='Swift module names that belong to the project')
    ap.add_argument('--out', default='score.json')
    args = ap.parse_args()
    declared = json.load(open(args.declared))
    report = {}
    for label, path, reader in (('rea', args.rea, rea_types), ('model', args.model, model_types)):
        if not path:
            continue
        result = score(declared, reader(path, args.modules))
        report[label] = result
        print(
            f"{label}: {result['recovered']}/{result['declared']} declared types by qualified name "
            f"({100 * result['recall']:.0f}%), kind correct for {result['kind_correct']}; "
            f"by bare name {result['bare_recovered']}/{result['bare_declared']}"
        )
    json.dump(report, open(args.out, 'w'), indent=1)


if __name__ == '__main__':
    main()
