#!/usr/bin/env python3
"""
Lists the types a Swift source tree declares, with their nesting, to score
type recovery against: `struct Recipe { enum Course {} }` declares `Recipe`
and `Recipe.Course`; types declared in `extension Recipe { ... }` nest under
`Recipe` too. Comments and string literals are skipped.

    python3 swift_declarations.py src/Salty src/Packages/SaltyCore/Sources --json declared.json
"""
import argparse
import json
import os
import re
import sys

KINDS = ('struct', 'class', 'enum', 'protocol', 'actor')
MODIFIERS = r'(?:(?:public|private|fileprivate|internal|open|package|final|indirect|nonisolated|static)\s+)*'
DECL = re.compile(r'(?:@[\w.]+(?:\([^()]*\))?\s+)*' + MODIFIERS + r'\b(struct|class|enum|protocol|actor|extension)\s+([A-Za-z_][\w.]*)')
NOT_A_NAME = {'func', 'var', 'let', 'subscript', 'init', 'deinit', 'override', 'static', 'case'}


def strip_comments_and_strings(text):
    """Blanks out comments and string literals (keeping newlines and braces outside them)."""
    out, i, n = [], 0, len(text)
    while i < n:
        if text.startswith('//', i):
            j = text.find('\n', i)
            i = n if j < 0 else j
        elif text.startswith('/*', i):
            depth, i = 1, i + 2
            while i < n and depth:
                if text.startswith('/*', i):
                    depth, i = depth + 1, i + 2
                elif text.startswith('*/', i):
                    depth, i = depth - 1, i + 2
                else:
                    i += 1
            out.append(' ')
        elif text.startswith('"""', i):
            j = text.find('"""', i + 3)
            i = n if j < 0 else j + 3
            out.append('""')
        elif text[i] == '"':
            j = i + 1
            while j < n and text[j] not in '"\n':
                j += 2 if text[j] == '\\' else 1
            i = j + 1
            out.append('""')
        else:
            out.append(text[i])
            i += 1
    return ''.join(out)


def declarations(text):
    """[(kind, qualified name)] declared in one Swift file."""
    text = strip_comments_and_strings(text)
    found = []
    stack = []  # (qualified context name, brace depth inside its body)
    depth = 0
    pending = None  # (kind, qualified) waiting for its opening brace
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == '{':
            depth += 1
            if pending:
                stack.append((pending[1], depth))
                pending = None
            i += 1
            continue
        if ch == '}':
            while stack and stack[-1][1] == depth:
                stack.pop()
            depth -= 1
            i += 1
            continue
        if ch in ';\n' and pending and pending[0] == 'protocol-decl-only':
            pending = None
        m = DECL.match(text, i) if (i == 0 or not (text[i - 1].isalnum() or text[i - 1] == '_')) else None
        if m and m.group(2) not in NOT_A_NAME:
            kind, name = m.group(1), m.group(2)
            parent = stack[-1][0] if stack else ''
            if kind == 'extension':
                qualified = name  # extensions name their type fully ("extension Recipe.Ingredient")
            else:
                qualified = f'{parent}.{name}' if parent else name
                found.append(('actor' if kind == 'actor' else kind, qualified))
            pending = (kind, qualified)
            i = m.end()
            continue
        i += 1
    return found


def scan(paths):
    declared = {}
    for root in paths:
        for folder, _dirs, files in os.walk(root):
            for f in files:
                if f.endswith('.swift'):
                    with open(os.path.join(folder, f), encoding='utf-8', errors='replace') as fh:
                        for kind, name in declarations(fh.read()):
                            declared.setdefault(name, kind)
    return declared


def selftest():
    src = '''
    struct Recipe: Codable {
        let name: String // struct NotAType
        enum Course: String { case main }
        private struct Box<T> where T: Equatable { var value: T }
        class func make() -> Recipe { Recipe(name: "struct Fake {") }
    }
    extension Recipe { enum CodingKeys: String, CodingKey { case name } }
    extension Recipe.Course { struct Label {} }
    @MainActor final class Store { actor Worker {} }
    protocol Source { func load() }
    '''
    got = declarations(src)
    names = [n for _k, n in got]
    assert names == ['Recipe', 'Recipe.Course', 'Recipe.Box', 'Recipe.CodingKeys', 'Recipe.Course.Label', 'Store', 'Store.Worker', 'Source'], names
    assert dict((n, k) for k, n in got)['Store.Worker'] == 'actor'


def main():
    selftest()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('paths', nargs='+')
    ap.add_argument('--json')
    args = ap.parse_args()
    declared = scan(args.paths)
    if args.json:
        json.dump(declared, open(args.json, 'w'), indent=1, sort_keys=True)
    kinds = {}
    for kind in declared.values():
        kinds[kind] = kinds.get(kind, 0) + 1
    print(f'{len(declared)} declared types {kinds}', file=sys.stderr)


if __name__ == '__main__':
    main()
