# Reverse-engineering tools

Small, dependency-free Python 3 scripts used for the study in [docs/reverse-engineering](../../docs/reverse-engineering/README.md). They run on Linux; no macOS tools are needed.

| Script | What it does |
| --- | --- |
| `swift_model.py` | Reads a Swift app's type model straight from its compiled Mach-O binary (stripped release builds included): every class, struct, enum and protocol with its module, nesting, stored fields and readable field types, from the Swift reflection metadata (`__swift5_types`, `__swift5_fieldmd`, `__swift5_reflstr`, `__swift5_protos`). Universal binaries are read for their arm64 slice. |
| `swift_declarations.py` | Lists the types a Swift source tree declares, by fully qualified name (`Recipe.Course`), skipping comments and strings: the answers to score against. |
| `score_swift_types.py` | Scores type recovery against those declarations, by qualified name (bare-name recall alongside): REA's `analyze_swift_types` output (decoding the mangled symbol names it reports) and `swift_model.py`'s. |
| `test_swift_model.py` | Unit tests for the type-name decoding: `python3 -m unittest test_swift_model`. |

```sh
python3 swift_model.py App.app/Contents/MacOS/App --module App --json model.json
python3 swift_model.py App.app/Contents/MacOS/App --type Recipe
python3 swift_declarations.py src/App src/Core --json declared.json
python3 score_swift_types.py --declared declared.json --model model.json --rea swift.json --modules App Core
```

Only use them on software you are allowed to analyze, and keep what you learn as summaries: never commit another app's binaries, assets or extracted data to this repository.
