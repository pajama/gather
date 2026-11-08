# Reverse engineering Crouton

Gather began as a test: how close can we get to [Crouton](https://crouton.app), the recipe manager from Crouton LLC that won an Apple Design Award for Interaction, using what can be learned about it from the outside, with the help of the reverse-engineering toolkit [REA](https://github.com/morluto/rea)?

This page records what we learned, where each fact came from, and what it changed in Gather. It holds summaries only. No Crouton code, assets, strings or binaries are in this repository, and Gather's copy and artwork are its own.

## Sources

| Source | What it gave us |
| --- | --- |
| The App Store listing and Crouton's website | The feature list, platforms (iOS, iPadOS, macOS, visionOS, watchOS), the subscription split |
| Crouton's press kit (linked from the website for press use) | Screenshots of every main screen on iPhone, iPad and Mac: the ground truth for layout and styling |
| Open-source projects that interoperate with Crouton: [crouton-sync](https://github.com/bridges-wood/crouton-sync)'s internals notes, and the Crouton importers in [Salty](https://github.com/RMoRobert/salty), [RecipeSage](https://github.com/julianpoy/RecipeSage) and [Recipya](https://github.com/reaper47/recipya-rs) | The data model (Core Data entities and fields), the 17 quantity types, the `.crumb` export format, the sync backend |
| REA, run against the website | DOM, accessibility tree, scripts and resources of crouton.app (a static marketing page, so little product insight) |
| REA, run against the Crouton app binary | Not yet: the zip we received was a macOS alias rather than the app. See [rea-evaluation.md](rea-evaluation.md) for the plan and what REA can and cannot do on Linux |

## Navigation and screens

From the press-kit screenshots:

- **Tabs (iPhone):** Meal Plan, Recipes, Groceries, Discover, Settings. Gather uses the same order and the same icons in spirit (calendar, recipe card, basket, sparkles, ellipsis).
- **Sidebar (iPad and Mac):** a Library section (Meal Plan, Recipes, Groceries, Discover), Folders with recipe counts and a New Folder row, Tags with a colored dot each, Settings at the top. Gather shows the same sidebar on windows 1000pt and wider.
- **Recipes tab:** opens on All Recipes with "‹ Collections" above it, a search field ("Recipes, Ingredients") and one large photo card per recipe. Gather mirrors this with a stack rooted at Collections.
- **Recipe page:** back link and title in a plain nav bar with a timer button and a "…" button; the photo as an inset rounded card with the name on it; a green Start pill, a yellow basket circle and a purple share circle; a servings tile and a Prep/Cook tile; an "Ingredients" header with Scale and settings pills; amounts in the accent color; one card per step with a numbered badge.
- **Step text:** ingredient names in the accent color (tap to see the amount in a bubble); durations in amber (tap to start a timer).
- **Timers:** a floating card at the top right with the step, the recipe, big amber digits and a ring that empties.
- **Step by step:** "Step 3" in gray over large text, round arrow buttons at the bottom corners, page dots between them, an Ingredients pill and a timer button at the top.
- **Meal plan:** a card per day with a gray header band ("Monday Sep 12"), a green + and a blue … on the band, and the planned recipes as thumbnail rows.
- **Groceries:** one white card per item with a rounded-square checkbox and the amount in the accent color. Adding an item opens a panel with the name in large type, unit chips (Item, Tablespoon, Teaspoon, Cup…), fraction keys and a colored number pad. Gather has the same panel.

## Visual language

- Rounded display type (SF Pro Rounded) for titles, card names, buttons and numbers; the system face for reading text. Gather uses Nunito, which Crouton's own website also uses, so titles look rounded on every platform.
- iOS system blue as the default accent, user-selectable app colors.
- A cool gray grouped background with white cards at a generous radius (about 20pt), soft shadows on floating elements.
- Pastel action colors with matching tints: green (start), yellow/orange (groceries), purple (share), red (delete).
- Text on photos is white with a shadow over a dark top gradient; servings and time sit in a frosted pill.

## Data model

From the open-source notes on Crouton's Core Data store (`Meals.sqlite`, synced with CloudKit):

| Crouton entity | Key fields | Gather |
| --- | --- | --- |
| `CDMeal` (recipe) | name, serves, duration (prep, minutes), cookingDuration, rating, rawDifficulty, defaultScale, notes, sourceName, webLink, nutritional info as "Key: value" lines, folderIDs, header image | `Recipe`: same fields; seconds instead of minutes; nutrition structured; `defaultScale` not modelled |
| `CDMeasuredIngredient` | amount, secondaryAmount (range end), quantityType, order, link to an ingredient name | Ingredients are stored as text and parsed on read (`core/recipe/ingredients.ts`), which keeps imports lossless; the parser recovers amount, range, unit and name |
| `CDIngredient` | a shared ingredient name | Not modelled separately; ingredient mentions in steps are matched by name |
| `CDMealStep` | step text, order, isSection | `StepSection`s with optional titles |
| `CDFolder` | name, an "inclusive" flag, tags (folders can collect recipes by tag) | `Folder` (manual membership); tag-based smart folders are a candidate next step |
| `CDTag` | name, color | Tags are strings; colors are derived from the name |
| `CDMealPlanItem` | meal plan entries | `MealPlanEntry` (with slots: breakfast, lunch, dinner, snack) |
| `CDTimer` | timers, persisted and synced | In-memory timers with notifications; persistence is a candidate next step |
| `CDFeed`, `CDFeedPost` | Discover feeds and posts | `Feed` with RSS/Atom items |
| `CDHousehold` | household sharing | Not modelled; Gather is local-first and sync-ready (see [architecture.md](../architecture.md)) |

**Quantity types:** ITEM, TEASPOON, TABLESPOON, CUP, OUNCE, POUND, GRAMS, KGS, MILLS, CENTILITER, LITRES, PINCH, BUNCH, CAN, BOTTLE, PACKET, and SECTION (an ingredient row that is really a heading). Crouton's grocery keypad offers the same set as chips.

### The `.crumb` format

A `.crumb` file is one recipe as JSON: the fields above plus `ingredients[{ order, ingredient: { name }, quantity: { amount, secondaryAmount, quantityType } }]`, `steps[{ order, step, isSection }]`, `images` (base64 JPEG) and `neutritionalInfo` (Crouton's spelling). Gather reads `.crumb` files and zips of them, and writes them back (`core/import/crumb.ts`, round-trip tested), so a Crouton library can move to Gather and individual recipes can go back.

## Feature parity

| Crouton | Gather |
| --- | --- |
| Import from websites, copied-link prompt | Yes (schema.org JSON-LD and microdata; the web build needs a small proxy because browsers block cross-site reads) |
| Import from Paprika and other apps | Paprika, Crouton `.crumb`, Gather files, saved pages, pasted text |
| Scan a cookbook page (OCR) | On the web: Tesseract runs in the browser and the text goes through the pasted-text parser for review. iOS and Android need a native text-recognition module (a development build) |
| AI import | Not yet |
| Scaling, unit conversion | Yes (servings or multiplier; as written, US, metric) |
| Timers from steps, floating timer card | Yes (notifications on device, chime on the web) |
| Step-by-step mode | Yes |
| Hands-free mode (wink, via the TrueDepth camera) | Read-aloud plus voice commands instead; face tracking is not available on the web |
| Meal planner, auto-generate | Yes (dinners from your dinner recipes, no repeats in a week) |
| Grocery lists from recipes, Reminders sync | Lists with merged amounts and aisles; no Reminders |
| Discover (recipe feeds) | Follow any blog's RSS/Atom feed |
| Folders, tags | Yes; tag colors derived, no smart folders yet |
| Ratings, difficulty | Yes |
| PDF export, print | Yes |
| iCloud sync, household sharing | Not yet (local-first; the storage layer is built to take a sync engine) |
| App colors, app icons | Twelve accent colors; one icon |
| iPad two-pane, Mac sidebar | Yes, on wide screens |
| Combustion thermometer, Bluetooth scales, Apple Watch, visionOS | No |
