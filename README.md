# Gather

A recipe manager and cooking companion: save recipes from anywhere, plan the week, build the grocery list and cook step by step.

Gather is an Expo (React Native) app. One TypeScript codebase runs on iOS, Android and the web.

## Getting started

```sh
npm install
npm run web        # web, in the browser
npm run ios        # iOS simulator (macOS)
npm run android    # Android emulator
```

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
| `src/features/` | Feature modules (library, recipe, cook, planner, groceries, import, settings). |
| `src/ui/` | Design system: tokens, theme and primitives. |

See [AGENTS.md](AGENTS.md) for the rules that keep these layers apart.
