# REA evaluation

How well does [REA](https://github.com/morluto/rea) ("reverse engineer anything") do on a task like this one? This page records what we ran, what worked, and where it got in the way. It will gain a section on the Crouton binary once we have the app itself (the first upload was a macOS alias file, not the zip).

## Setup

- REA 6.8.0 from npm (`rea-agents`), driven both as a CLI and as an MCP server.
- Host: a Linux x86-64 development server. No macOS host was available to the agent.
- Ghidra 12.1.4 and a JDK 25 for native (Mach-O) analysis.

## What worked

| Capability | Result |
| --- | --- |
| `inspect-artifact` on an app zip | Complete inventory of a 1,643-entry macOS app bundle with a content-addressed evidence bundle, in seconds |
| `decode-interface-builder` | Decoded compiled nibs on Linux |
| Ghidra-backed `search_strings` on an arm64 Mach-O | Worked; results carry addresses and the analysis profile |
| `analyze_swift_types` | Grouped about 1,000 Swift symbols of a SwiftUI app into classes, structs, enums, protocols and extensions straight from the manglings. This is the tool that would recover Crouton's model and view types |
| MCP mode | One Ghidra analysis, then follow-up queries in about 2 seconds each |
| `inspect_web_page` on crouton.app (over Chrome DevTools) | DOM, accessibility tree, scripts and resources in 3 seconds. The site is a static marketing page, so the useful finding was small: the Nunito webfont |

The evidence model is a strength: every result says which provider produced it, with what settings, what was examined, and what remains unknown. That makes results easy to trust or discount.

## Where it got in the way

| Issue | Workaround |
| --- | --- |
| `rea doctor` accepted Ghidra 12.2, but opening a binary rejected it (REA pins Ghidra 12.1.x) | Install 12.1.4 |
| The JDK 25 requirement only surfaced when opening a binary | Install a JDK 25 |
| Ghidra cannot import a universal (fat) Mach-O, which is how Mac apps ship | Thin it first: `llvm-lipo App -thin arm64 -output App-arm64` |
| Each CLI call re-imports and re-analyzes the binary (about 1m45s for a 2.4 MB executable; `--snapshot` does not keep the Ghidra database) | Run REA as an MCP server and keep one session open |
| On Linux, property-list, Mach-O header, code-signature and asset-catalog inspection and Swift demangling are unavailable: they shell out to macOS tools (`plutil`, `otool`, `codesign`, `assetutil`, `swift-demangle`) | Python's `plistlib` for property lists; demangling and asset catalogs need a Mac |

## Verdict so far

REA is a capable, well-instrumented front end to Ghidra and friends, and its web and Swift-type tooling is genuinely useful. For an Apple app, though, the most valuable layers (asset catalogs for colors and icons, property lists, entitlements, demangled names) need a macOS host. On Linux it covers the binary but not the bundle around it.

For this project the decisive facts came from elsewhere: the developer's press-kit screenshots fixed the design, and open-source projects that interoperate with Crouton documented its data model and file format. When the binary arrives, the plan is:

1. Inventory the bundle (`inspect-artifact`) and read `Info.plist` and entitlements with `plistlib`.
2. Thin the executable and open one Ghidra session over MCP.
3. `analyze_swift_types` for the model, view and service types; compare them against the public data model, which doubles as a check on REA's accuracy.
4. `search_strings` and `batch_decompile` for the ingredient parser, timer detection and import classifier, to compare their behavior with Gather's.
