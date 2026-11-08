# Gather

A recipe manager and cooking companion: save recipes from anywhere, plan the week, build the grocery list and cook step by step.

Gather is an Expo (React Native) app. One TypeScript codebase runs on iOS, Android and the web.

Gather started as a study: how close can a team get to [Crouton](https://crouton.app), the Apple Design Award-winning recipe app, by reverse engineering what is publicly knowable about it? [docs/reverse-engineering](docs/reverse-engineering/README.md) records what we learned and where it came from. Gather's code, copy and artwork are its own.

## What it does

- **Save recipes from anywhere:** websites (schema.org), pasted text, a photo of a cookbook page (text recognition, on the web for now), Crouton `.crumb` files, Paprika exports, Gather files, saved pages. A copied link prompts an import.
- **Recipes:** scaling by servings or multiplier, US/metric conversion, ingredient check-off, tappable timers in steps, ingredient callouts, ratings, difficulty, notes, nutrition, print and PDF.
- **Step-by-step cooking** with hands-free mode (read aloud, voice commands) and floating timers.
- **Meal plan:** a card per day, automatic dinner planning from your recipes, one tap to shop for the week.
- **Groceries:** merged amounts from every recipe, aisle grouping, a quick-entry keypad.
- **Discover:** follow food blogs and import new posts in one tap.
- **Collections:** folders, favorites, tags. Twelve accent colors, light and dark.
- iPhone-style tab bar on phones; a sidebar and two-pane layout on tablets and desktop browsers.

## Getting started

```sh
npm install
npm run web        # web, in the browser
npm run ios        # iOS simulator (macOS)
npm run android    # Android emulator
```

Importing from websites works directly on iOS and Android. Browsers block reading other sites, so on the web run the import helper in a second terminal:

```sh
npm run proxy      # localhost:8787; Gather on localhost uses it automatically
```

For a hosted web build, set `EXPO_PUBLIC_IMPORT_PROXY` to your own proxy.

## Checks

```sh
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript
npm run lint       # ESLint (expo lint)
```

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Routes (Expo Router). Thin: each screen composes a feature. |
| `src/core/` | Pure TypeScript domain logic: parsing, scaling, units, timers, import. No React. |
| `src/data/` | Persistence behind repository interfaces, with native and web adapters. |
| `src/features/` | Feature modules (library, recipe, cook, timers, planner, groceries, import, feeds, settings, shell). |
| `src/ui/` | Design system: tokens, theme and primitives. |

See [AGENTS.md](AGENTS.md) for the rules that keep these layers apart and [docs/architecture.md](docs/architecture.md) for how data flows and how to add a feature.
