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
| `grocery/*` | Aisle lookup and merging (`1 cup milk + ½ cup milk → 1½ cups milk`) |
| `planner/planner.ts` | Day keys, week ranges, automatic meal-plan generation |
| `model/*` | Entity types, factories, library search/sort, editor text round-trip |

Importers produce a platform-neutral `RecipeDraft`; `model/recipe.ts` turns a draft into a stored `Recipe`. New import sources (a photo/OCR importer, another app's export format) only need to produce a draft.

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
- **Services** hold side effects that are not storage: `page-fetcher(.web).ts` (the web build goes through an import proxy because browsers block cross-site reads), `feeds.ts`, `backup-file(.web).ts`.
- **Sync-ready.** Every document carries `createdAt`/`updatedAt` and stable ids, which is what a sync engine (iCloud-style or a server) needs. Sync would be another layer over `DocumentStore`; screens would not change.

### ui: the design system

- `theme/tokens.ts`: light/dark palettes, spacing, radii, the type ramp, and the user-selectable accent colors.
- `theme/theme.tsx`: `ThemeProvider` builds the theme from the accent and color-scheme preference; components call `useTheme()`.
- `primitives/*`: `Text`, `Icon` (semantic names, one place to swap icon sets), `Tap` (press feedback + haptics), `Button`, `IconButton`, `Card`, `ListSection`/`ListRow`, `SearchField`, `Field`, `SegmentedControl`, `Stepper`, `Checkbox`, `Chip`, `EmptyState`, `Photo`, `Sheet`, `Screen`, `LargeHeader`.

Screens never hard-code colors or font sizes; they read tokens. Changing the look (for example matching another app's palette) is a tokens change.

### features

| Feature | Route(s) | Notes |
| --- | --- | --- |
| `library` | `/` | Grid, search across ingredients, folders, favorites, sort, clipboard-link import prompt |
| `recipe` | `/recipe/[id]` | Hero, stats, scaling, unit conversion, ingredient check-off, timers in steps, plan/groceries sheets |
| `cook` | `/recipe/[id]/cook` | Step-by-step pager, "In this step" ingredients, timers; global `TimersProvider` + heads-up display |
| `editor` | `/recipe/new`, `/recipe/[id]/edit` | Text-first editing (one line per ingredient/step, `Heading:` sections), photos |
| `import` | `/import` | Website (schema.org) and pasted text |
| `feeds` | `/discover` | Follow blogs; new posts become one-tap imports |
| `planner` | `/plan` | Rolling week, slots, recipe picker, auto-fill dinners, shop for planned meals |
| `groceries` | `/groceries` | Merged amounts, by aisle or by recipe, in-cart section |
| `settings` | `/settings` | Accent color, theme, units, keep-awake, planner meals, backup/restore |
| `onboarding` | — | First-run sample recipes and their bundled photos |

## Adding a feature: a worked example

Say we want **recipe ratings** shown on cards and editable on the recipe screen.

1. **Model.** `Recipe.rating?: number` already exists in `core/model/types.ts`. For a new field, add it there and give it a default in `data/migrations.ts` if it is required.
2. **Domain operation.** Add the operation to the repository (`RecipesRepository.setRating` exists) and a test in `data/database.test.ts`.
3. **UI.** Build a `RatingStars` component in `src/features/recipe/` from `ui` primitives (`Icon`, `Tap`), call `db.recipes.setRating(...)`.
4. **Route.** Nothing to do unless the feature needs a new screen; then add `src/app/<route>.tsx` that re-exports the feature screen.
5. **Check.** `npm run check` (typecheck, lint with layer rules, tests) and `npm run build:web && npm run screenshots`.

Larger features follow the same path. A Crouton `.crumb` importer, for example, is a `core/import/crumb.ts` that returns `RecipeDraft`s, plus a button in the import screen.

## Platform notes

- **Web import proxy.** Browsers cannot read most recipe sites (CORS). `scripts/import-proxy.mjs` is a tiny proxy for development; set `EXPO_PUBLIC_IMPORT_PROXY` when building the web app. On iOS and Android, pages are fetched directly.
- **Images.** Imported recipes keep the source's image URL; photos added in the editor are stored as files (device) or data URLs (web). Sample photos ship in `assets/seed` and are referenced as `asset://seed/<name>`.
- **Keep awake** uses `expo-keep-awake` on device; the web has no equivalent.

## Testing and verification

- `npm test`: Vitest unit tests for `core` and `data` (storage runs on `MemoryStore`).
- `npm run typecheck`, `npm run lint`.
- `npm run build:web && npm run screenshots`: renders key screens in light, dark and desktop sizes with headless Chromium and fails on console errors. With the import proxy running, `IMPORT_URL=… FEED_URL=…` also exercises live import and feeds.
