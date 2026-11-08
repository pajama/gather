# Gather: working agreement

Gather is an Expo (React Native + web) recipe manager. Read this before changing code.

## Layers (dependencies point down only)

1. `src/core/` is pure TypeScript domain logic. It never imports React, React Native, Expo or anything in `src/data`, `src/features`, `src/ui` or `src/app`. Everything here is unit-tested with Vitest.
2. `src/data/` owns persistence. Features talk to repositories, never to storage engines. Platform adapters (`*.native.ts` / `*.web.ts`) live here.
3. `src/ui/` is the design system: tokens, theme, primitives. No domain knowledge.
4. `src/features/<feature>/` holds screens, components and hooks for one feature. A feature may use `core`, `data` and `ui`, and another feature only through that feature's `index.ts`.
5. `src/app/` holds Expo Router routes only. A route file renders a feature screen and does little else.

## Expo has changed: do not trust training data

This project uses Expo SDK 58. Before touching an Expo or React Native API, read the versioned docs at `https://docs.expo.dev/versions/v58.0.0/` (index: https://docs.expo.dev/llms.txt). Add native packages with `npx expo install <pkg>`, never plain npm.

## Commands

```sh
npm test            # Vitest (src/**/*.test.ts)
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm run web         # dev server for the web
npm run build:web   # static web export to dist/
npm run bundle:native  # iOS + Android JS bundles (catches native-only resolution errors)
```

Run tests and typecheck before calling work done.

## Conventions

- Conventional Commit subjects (`feat(planner): …`, `fix(import): …`).
- Domain logic gets a test next to it (`foo.ts` + `foo.test.ts`).
- Copy and artwork are Gather's own. Never commit assets, strings or binaries taken from other apps.
