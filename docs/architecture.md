# Gather architecture

Gather is a local-first recipe manager built with Expo (React Native) and TypeScript. One codebase ships to iOS, Android and the web. This document explains how the code is organised, how data flows, and how to add a feature without breaking the structure.

## Goals that shaped the design

- **Works offline, instantly.** Everything a person saves lives on their device and renders without a network round trip.
- **One codebase, three platforms.** Platform differences (storage, file access, fetching) sit behind small interfaces with `.native`/`.web` implementations, never inside screens.
- **Domain logic you can test without a phone.** Recipe parsing, scaling, unit conversion, timers, grocery merging, planning and import are plain TypeScript with unit tests.
- **Easy to extend.** A new feature touches one feature folder, maybe a repository, and a route file.

## Layers

```
src/
  app/        Expo Router routes. Thin: render a feature screen.
  features/   One folder per feature: screens, components, hooks.
  ui/         Design system: tokens, theme, primitives. No domain knowledge.
  data/       Persistence and side effects: storage engines, collections,
              repositories, services (network, files), React bindings.
  core/       Pure TypeScript domain logic. No React, no Expo.
```

Dependencies point down only: `app → features → (ui, data) → core`. ESLint enforces the important edges with `no-restricted-imports` (see `eslint.config.js`):

| Layer | May not import |
| --- | --- |
| `src/core` | React, React Native, Expo, `@/data`, `@/ui`, `@/features`, `@/app` |
| `src/data` | `@/ui`, `@/features`, `@/app` |
| `src/ui` | `@/core`, `@/data`, `@/features`, `@/app` |

### core: the domain

| Module | What it does |
| --- | --- |
| `recipe/quantity.ts` | Parses `1 1/2`, `1½`, `2-3`, `½ to 1`; formats as kitchen fractions or metric decimals |
| `recipe/units.ts` | Unit table (aliases such as `T` vs `t`), conversion, readable-unit choice (`48 tsp → 1 cup`), US/metric |
| `recipe/ingredients.ts` | Ingredient line parsing (amount, package size, alternate measure, name, note) and formatting with scale/units |
| `recipe/durations.ts` | Finds `25-30 minutes` / `1 hour 15 minutes` in steps (timers); ISO 8601 metadata |
| `recipe/mentions.ts` | Finds which ingredients a step mentions, for cook mode callouts |
| `import/web.ts` | schema.org Recipe extraction from JSON-LD (incl. `@graph`, `HowToSection`) with a microdata fallback |
| `import/text.ts` | Pasted-text recipes: section markers when present, line shape otherwise |
| `import/feed.ts` | RSS/Atom parsing and feed discovery |
| `import/files.ts` | Recipe files: Paprika exports, Gather files, saved pages, text, and Crouton files via `import/crumb.ts` |
| `import/crumb.ts` | Crouton `.crumb` JSON in both directions (quantity types, `SECTION` headings, section steps, nutrition lines) |
| `import/scan.ts` | Cleans text recognized from a cookbook photo (hyphenation, reflow, misread amounts) for the text parser |
| `timers/timers.ts` | Kitchen timers as plain data: start, pause, resume, add time, status from the clock |
| `grocery/*` | Aisle lookup and merging (`1 cup milk + ½ cup milk → 1½ cups milk`) |
| `planner/planner.ts` | Day keys, week ranges, automatic meal-plan generation |
| `model/*` | Entity types, factories, library search/sort, editor text round-trip |

Importers produce a platform-neutral `RecipeDraft`; `model/recipe.ts` turns a draft into a stored `Recipe`. New import sources (a photo/OCR importer, another app's export format) only need to produce a draft. `import/crumb.ts` is the model to copy: a reader, a writer and a round-trip test.

### data: storage, repositories and services

```
DocumentStore (interface)      SQLiteStore (device) | IndexedDBStore (web) | MemoryStore (tests)
        ▲
Collection<T>                  in-memory cache, synchronous reads, ordered write-through, subscriptions
        ▲
Repositories                   RecipesRepository, FoldersRepository, PlannerRepository,
                               GroceriesRepository, FeedsRepository: the domain operations
        ▲
Database                       wires collections + repositories, migrations, seeding, backups
        ▲
React bindings (react.tsx)     <DatabaseProvider>, useRecipes(), useRecipe(id), usePlanEntries(days)…
```

- **Documents, not tables.** Each entity is a JSON document keyed by `(collection, id)`. Adding a field never needs a schema migration; `migrations.ts` fills defaults when older documents load.
- **Reads are synchronous.** Collections load fully at startup (recipe libraries are small), so screens render from memory with no loading states. Writes update memory first, notify subscribers, then persist in order.
- **Engines are swappable.** `open-store.ts` / `open-store.web.ts` pick SQLite or IndexedDB. Metro resolves the platform file; tests use `MemoryStore`.
- **Services** hold side effects that are not storage: `page-fetcher(.web).ts` (the web build goes through an import proxy because browsers block cross-site reads), `feeds.ts`, `backup-file(.web).ts`, `scan-text(.web).ts` (text recognition with Tesseract in the browser, loaded on first use), `timer-alerts(.web).ts`, `print-recipe(.web).ts`.
- **Sync-ready.** Every document carries `createdAt`/`updatedAt` and stable ids, which is what a sync engine (iCloud-style or a server) needs. Sync would be another layer over `DocumentStore`; screens would not change.

### ui: the design system

- `theme/tokens.ts`: light/dark palettes (including the pastel green/yellow/purple action tints and the amber timer color), spacing, radii, the type ramp (rounded Nunito for titles, buttons and numbers; the system face for reading text), and the user-selectable accent colors.
- `theme/theme.tsx`: `ThemeProvider` builds the theme from the accent and color-scheme preference; components call `useTheme()`.
- `primitives/*`: `Text`, `Icon` (semantic names, one place to swap icon sets), `Tap` (press feedback + haptics), `Button` and `IconButton` (filled, tinted and pastel variants), `Card`, `ListSection`/`ListRow`, `SearchField`, `Field`, `SegmentedControl`, `Stepper`, `Checkbox`, `Chip`, `EmptyState`, `Photo`, `Sheet`, `Screen`, `LargeHeader` (nav row with back link and actions above a large title), `BackLink`.
- `useAppLayout()` decides between the phone layout (tab bar) and the wide layout (sidebar, from 1000pt) and reports the width left for the screen.

Screens never hard-code colors or font sizes; they read tokens. Changing the look is mostly a tokens change: matching Crouton's published screenshots was a tokens change plus new layouts for a handful of screens.

### features

| Feature | Route(s) | Notes |
| --- | --- | --- |
| `library` | `/` (All Recipes), `/collections`, `/collection/[id]` | The Recipes tab is a stack rooted at Collections (folders, favorites, colored tags) and opens on All Recipes. Photo cards with a frosted servings/time pill; on wide screens a list beside the open recipe |
| `recipe` | `/recipe/[id]` | Inset hero with the title on it, Start / groceries / share actions, servings and time tiles, rating and difficulty, scaling and measurement sheets, one card per step with tappable timers and ingredient callouts |
| `cook` | `/recipe/[id]/cook` | Step-by-step: one large step per page, arrows and page dots, hands-free (read aloud + voice commands) |
| `timers` | (overlay) | `TimersProvider` above navigation, the floating timer card, the timer sheet for custom timers |
| `editor` | `/recipe/new`, `/recipe/[id]/edit` | Text-first editing (one line per ingredient/step, `Heading:` sections), photos, rating, difficulty |
| `import` | `/import` | Website (schema.org), pasted text, cookbook scan (web), files (Crouton, Paprika, Gather, saved pages) |
| `feeds` | `/discover` | Follow blogs; new posts become one-tap imports |
| `planner` | `/plan` | A card per day with + and … buttons, slots, recipe picker, plan dinners automatically, shop for the week |
| `groceries` | `/groceries` | One card per item, merged amounts, optional grouping by aisle or recipe, Crouton-style entry panel (unit chips, fractions, number pad) |
| `settings` | `/settings` | Accent color, theme, units, keep-awake, planner meals, backup/restore |
| `shell` | (tab bar) | The wide-screen sidebar: Library, Folders, Tags, Settings |
| `onboarding` | — | First-run sample recipes and their bundled photos |

Features talk to each other only through each feature's `index.ts` (for example `recipe` and `cook` both use `@/features/timers`; `cook` uses `@/features/recipe` for step rendering).

## Adding a feature: a worked example

Recipe **ratings and difficulty** went in like this, and most features follow the same path:

1. **Model.** Add the field to `core/model/types.ts` (`rating?: number`, `difficulty?: Difficulty`) and to `RecipeDraft` if importers can fill it; map it in `recipeFromDraft`/`recipeToDraft`. Give it a default in `data/migrations.ts` only if it is required.
2. **Domain logic.** Pure functions with tests next to them: the `rating` sort in `core/model/library.ts`, the `.crumb` mapping in `core/import/crumb.ts`.
3. **Domain operation.** Add it to the repository (`RecipesRepository.setRating`) and a test in `data/database.test.ts`.
4. **UI.** A `RatingStars` component in `src/features/recipe/` built from `ui` primitives, exported from the feature's `index.ts` so the editor can use it.
5. **Route.** Nothing to do unless the feature needs a new screen; then add `src/app/<route>.tsx` that re-exports the feature screen.
6. **Check.** `npm run check` (typecheck, lint with layer rules, tests) and `npm run build:web && npm run screenshots`.

## Platform notes

- **Web import proxy.** Browsers cannot read most recipe sites (CORS). `scripts/import-proxy.mjs` is a tiny proxy for development; set `EXPO_PUBLIC_IMPORT_PROXY` when building the web app. On iOS and Android, pages are fetched directly.
- **Images.** Imported recipes keep the source's image URL; photos added in the editor are stored as files (device) or data URLs (web). Sample photos ship in `assets/seed` and are referenced as `asset://seed/<name>`.
- **Keep awake** uses `expo-keep-awake` on device; the web has no equivalent.
- **Fonts.** Nunito (the rounded display face) is bundled through `@expo-google-fonts/nunito` and loaded before the splash screen hides.
- **SQLite writes are serialized.** expo-sqlite's `withTransactionAsync` is not exclusive, so collections writing at the same time would interleave `BEGIN`/`COMMIT` on the shared connection and lose writes. `SQLiteStore` runs every operation through one `SerialQueue` (`data/store/serial.ts`).
- **Keyboard.** Android 15 draws apps edge to edge, so the window no longer shrinks for the keyboard. Bottom-anchored UI (sheets, the grocery entry panel) moves up by `useKeyboardHeight()` from `ui`; scrolling screens with inputs use `KeyboardAvoidingView` with `padding` on both platforms. The grocery panel collapses to the name field while the keyboard is up; Next brings back the number pad.
- **Recipes tab start.** Deep links get Collections under All Recipes from the stack's `anchor`. A native cold start has no deep link and would open on Collections, so `CollectionsScreen` pushes All Recipes once, without animation.
- **Native check.** The app has been exercised on Android 15 emulators in Expo Go. On a phone: library, recipe, step-by-step, timers (including the system notification when one finishes), groceries and the entry panel with the on-screen keyboard, meal plan, collections, settings, dark mode, website import, and data surviving an app restart. On a Pixel Tablet: the sidebar and two-pane library in landscape, switching to the phone layout in portrait and back.
- **Orientation.** The app rotates (`"orientation": "default"`). A portrait lock would keep tablets out of the sidebar layout: Android 15 letterboxes portrait-only apps on landscape tablets, and iPad would never get a landscape window.

## Testing and verification

- `npm test`: Vitest unit tests for `core` and `data` (storage runs on `MemoryStore`).
- `npm run typecheck`, `npm run lint`.
- `npm run bundle:native`: builds the iOS and Android JavaScript bundles, which catches native-only import and resolution errors without a simulator.
- `npm run build:web && npm run screenshots`: renders key screens in light, dark and desktop sizes with headless Chromium and fails on console errors. With the import proxy running, `IMPORT_URL=… FEED_URL=…` also exercises live import and feeds.
