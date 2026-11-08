# Reverse-engineering tools

Small, dependency-free Python 3 scripts used for the study in [docs/reverse-engineering](../../docs/reverse-engineering/README.md). They run on Linux; no macOS tools are needed.

| Script | What it does |
| --- | --- |
| `swift_model.py` | Reads a Swift app's type model straight from its compiled Mach-O binary (stripped release builds included): every class, struct, enum and protocol with its module, nesting, stored fields and readable field types, from the Swift reflection metadata (`__swift5_types`, `__swift5_fieldmd`, `__swift5_reflstr`, `__swift5_protos`). Universal binaries are read for their arm64 slice. |
| `score_swift_types.py` | Scores REA's `analyze_swift_types` output against the type declarations in a source tree, decoding the mangled symbol names REA reports. |

```sh
python3 swift_model.py App.app/Contents/MacOS/App --module App --json model.json
python3 swift_model.py App.app/Contents/MacOS/App --type Recipe
```

Only use them on software you are allowed to analyze, and keep what you learn as summaries: never commit another app's binaries, assets or extracted data to this repository.
