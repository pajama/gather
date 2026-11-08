# REA evaluation

How capable is [REA](https://github.com/morluto/rea) ("reverse engineer anything") on a job like this one: learning enough about a shipped iOS/macOS app to rebuild it? This page records what we ran, how well it did, and where it got in the way. A section on the Crouton binary will follow once we have the app itself (the first upload was a macOS alias file, not the zip).

## Setup

- REA 6.8.0 from npm (`rea-agents`), driven both as a CLI and as an MCP server.
- Host: a Linux x86-64 development server. No macOS host was available.
- Ghidra 12.1.4 and a JDK 25 for native (Mach-O) analysis.

## Ground-truth test: an open-source recipe app

To measure REA rather than guess, we ran it on [Salty](https://github.com/RMoRobert/salty) 3.4.3, an open-source (Apache-2.0) SwiftUI recipe manager for macOS, using the developer's own release build: a stripped, optimized binary like any App Store app (16.6 MB arm64 slice). The source at the same tag gives the right answers: 481 types declared in the app and its core package (289 in `Salty`, 192 in `SaltyCore`).

| Approach | Types recovered | Fields | Time |
| --- | --- | --- | --- |
| REA `analyze_swift_types` (symbol names) | 9 of 481 (2%): only classes the Objective-C runtime can see, plus three structs | none | 584 s for the first query (Ghidra import and analysis), then about 2 s per query |
| REA string inventory (`list_strings`) | 421 of 481 type names appear as exact strings (88%), almost all among the 2,309 strings in `__TEXT,__const`, but nothing marks which strings are type names | none: Ghidra defines no strings in `__swift5_reflstr`, where field names live | 1.4 s (paged) |
| Our metadata reader ([`tools/reverse-engineering/swift_model.py`](../../tools/reverse-engineering/swift_model.py)) | 427 of 476 classes, structs and enums (90%), plus protocols, with module and nesting | every stored field with a readable type; for the 12 core model types, 91 of 91 fields correct in name and order | about 2 s, no disassembler |

What the reader produced for Salty's recipe model, from the binary alone:

```
struct SaltyCore.Recipe { id: String, name: String, createdDate: Date, lastModifiedDate: Date, lastPrepared: Date?,
  …, difficulty: Difficulty, rating: Rating, imageFilename: String?, isFavorite: Bool, wantToMake: Bool, yield: String,
  servings: Int?, courseId: String?, directions: [Direction], ingredients: [Ingredient], notes: [Note],
  variations: [Variation], preparationTimes: [PreparationTime], nutrition: NutritionInformation? }
enum SaltyCore.Difficulty { notSet, easy, somewhatEasy, medium, slightlyDifficult, difficult }
```

The 49 types it missed have no runtime metadata at all: SwiftUI helper views the optimizer specialized away, case-less enums used as namespaces, preview providers.

**Behavior.** `trace_feature "tablespoon"` found the strings and the one function that uses them in under a second, and `procedure_pseudo_code` decompiled it. Ghidra's pseudo-C showed a lazy initializer building a nine-entry `[String: String]` dictionary, with Swift runtime calls and no names. Reading the entries took a ten-line decoder for Swift's inline strings: UN/CEFACT unit codes (`G21` cup, `G24` tablespoon, `G25` teaspoon, `GRM` g …), which Salty uses for structured recipe data. So REA finds code fast, but Swift semantics are left to the analyst.

**Takeaways**

1. REA's Swift type tool reads symbol names, and a release build has almost none. On real apps it recovers a few percent of the types.
2. The type model is all there in Swift's reflection metadata, which REA does not parse. A 300-line reader over the same binary recovers about 90% of types and every field, on Linux, in seconds. That reader is what we will point at Crouton.
3. REA's navigation (strings, references, containing procedures) and Ghidra decompilation work well and quickly once a session is warm.

## What else worked

| Capability | Result |
| --- | --- |
| `inspect-artifact` on an app zip | Complete inventory of a 1,643-entry macOS app bundle with a content-addressed evidence bundle, in seconds |
| `decode-interface-builder` | Decoded compiled nibs on Linux |
| MCP mode | One Ghidra analysis, then follow-up queries in about 2 seconds each |
| `inspect_web_page` on crouton.app (over Chrome DevTools) | DOM, accessibility tree, scripts and resources in 3 seconds. The site is a static marketing page, so the useful finding was small: the Nunito webfont |
| Paging large results | `list_strings` on Salty (51,519 strings) exceeded REA's 10 MB MCP response limit; the error named the continuation, and `inspect_analysis_view` paged through the retained evidence in 1.4 s |

The evidence model is a strength: every result says which provider produced it, with what settings, what was examined and what remains unknown, so results are easy to trust or discount.

## Where it got in the way

| Issue | Workaround |
| --- | --- |
| `rea doctor` accepted Ghidra 12.2, but opening a binary rejected it (REA pins Ghidra 12.1.x) | Install 12.1.4 |
| The JDK 25 requirement only surfaced when opening a binary | Install a JDK 25 |
| Ghidra cannot import a universal (fat) Mach-O, which is how Mac apps ship | Thin it first: `llvm-lipo App -thin arm64 -output App-arm64` |
| Each CLI call re-imports and re-analyzes the binary (1m45s for a 2.4 MB executable, nearly 10 minutes for 16.6 MB; `--snapshot` does not keep the Ghidra database) | Run REA as an MCP server and keep one session open |
| On Linux, property-list, Mach-O header, code-signature and asset-catalog inspection and Swift demangling are unavailable: they call macOS tools through `xcrun` (`plutil`, `otool`, `codesign`, `assetutil`, `swift-demangle`) | Python's `plistlib` for property lists; our own decoding for Swift names and metadata; asset catalogs need a Mac |
| Swift type recovery depends on symbols (see above) | `swift_model.py` |

## Verdict

REA is a capable, well-instrumented front end to Ghidra and friends: fast navigation once warm, honest evidence, and useful web tooling. For Swift apps on Linux, though, its built-in tools miss the layer that matters most for a rebuild, the type model, and the macOS-only tools cover the bundle around the binary. A small purpose-built reader closed the gap on Salty with 90% type recall and exact fields.

For Gather the decisive facts so far came from the developer's press-kit screenshots and from open-source projects that document Crouton's data model and file format. When the Crouton binary arrives:

1. Inventory the bundle (`inspect-artifact`); read `Info.plist`, entitlements and any Core Data model (`.momd`, a binary-plist keyed archive) with `plistlib` or REA's `inspect_keyed_archive`.
2. Run `swift_model.py` for the Swift types and fields, and compare them with the public data-model notes (a further accuracy check).
3. Open one Ghidra session over MCP and use `trace_feature` and decompilation to compare the ingredient parser, timer detection and import heuristics with Gather's.
