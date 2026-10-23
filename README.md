# TikiTaki

[![Tests and build](https://github.com/gagarinbefree/TikiTaki/actions/workflows/ci-pages.yml/badge.svg?branch=main)](https://github.com/gagarinbefree/TikiTaki/actions/workflows/ci-pages.yml)
[![Release](docs/badges/release.svg?version=0.1.0-alpha.0.deploy.16.1)](https://github.com/gagarinbefree/TikiTaki/releases/latest)

**Latest release:** <!-- release-version -->v0.1.0-alpha.0.deploy.16.1<!-- /release-version -->

A zero-runtime-dependency TypeScript engine for swipe navigation across a ragged two-dimensional grid. Each row can have a different positive length. The engine provides navigation, pointer gestures, bounded DOM rendering, and optional React, Vue, Svelte, and Angular adapters.

The project is a private alpha. Google Chrome Desktop and Chrome touch emulation are tested. Physical Android verification is deferred at the user's request. There is no video player, backend, recommendation service, or media upload system.

Both framework demos open at **A1** and return to A1 after remount. The **Go to A10** control remains available for trying navigation from the end of the first row.

The demos use locally bundled Bootstrap 6.0.0-alpha.1 CSS from the official release tag. Layout uses Bootstrap cards, responsive columns, utility classes, and theme-aware buttons. No Bootstrap JavaScript is included. The core remains free of runtime dependencies.

## Functional API

Create independent controllers through factories. State lives in private closures; operations do not use classes, prototypes, singletons, or a `this` receiver. Methods can be destructured safely.

```ts
import { createSwipeEngine } from 'tikitaki/dom';

/** Mount an independent swipe view; the caller owns its cleanup. */
export function mount(container: HTMLElement) {
  const engine = createSwipeEngine({
    container,
    grid: [['A1', 'A2'], ['B1'], ['C1', 'C2', 'C3']],
    renderCell(item) {
      const element = container.ownerDocument.createElement('div');
      element.textContent = item;

      return element;
    },
    onPositionChange(position, previous) {
      console.log(previous, position);
    },
    onError(error) {
      console.error(error);
    },
  });

  return engine;
}
```

Give the container an explicit CSS size, such as `height: 100dvh`. The engine applies `touch-action: none` only to its container. Call `engine.destroy()` when the view is removed.

| Operation             | Behavior                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `getPosition()`       | Read a frozen snapshot of the last committed position                                                 |
| `navigate(direction)` | Animate one neighboring transition; resolve `true` after commit                                       |
| `goTo(position)`      | Immediately show any valid cell; resolve whether the position changed                                 |
| `updateGrid(grid)`    | Validate a replacement grid, cancel pending motion, clamp coordinates when needed, and update hosts   |
| `destroy()`           | Release listeners, pointer capture, observers, RAF work, and mounted content; repeated calls are safe |

Navigation promises resolve `false` at a boundary, for the same target, while busy, on cancellation, or after destruction. Commands are not queued. Invalid arguments reject while the controller is alive. Position callbacks run after host synchronization and may start another command. A callback exception rejects its operation after the position has committed. See [API.md](./API.md) for the complete lifecycle and error contract.

## Navigation rules

- Swipe up: next row, always column zero.
- Swipe down: previous row, always column zero.
- Swipe left: next column in the current row.
- Swipe right: previous column in the current row.
- An unavailable transition preserves the entire position, including the column.
- A gesture commits at most one neighbor and locks to one axis.

For example: `A10 → up → B1 → up → C1 → left → C2 → down → B1 → down → A1`. Previous row columns are never remembered.

## Headless layers

The `tikitaki` entry point works without DOM globals or DOM TypeScript libraries.

```ts
import { createNavigationModel, createGestureEngine } from 'tikitaki';

const model = createNavigationModel([['A1', 'A2'], ['B1']]);
const { navigate, getPosition } = model;
navigate('up');
console.log(getPosition());
```

`createGestureEngine(context, options?)` consumes normalized pointer samples and returns commit/rollback plans without touching the DOM. `createDOMRenderer(options)` and `createDOMAdapter(renderCell)` are available from `tikitaki/dom` for integrations that coordinate these layers themselves.

## Configuration

Production tuning values, validation messages, DOM tokens, and styles are centralized in [src/config.ts](./src/config.ts). Demo data, labels, and initial coordinates live in [demos/config.ts](./demos/config.ts). Optional adapters have their own `src/config.ts`. Formatting, server addresses, and browser geometry are configured in [tooling.config.mjs](./tooling.config.mjs).

The public `DEFAULT_GESTURE_OPTIONS` object is immutable. Override supported values through `gesture: Partial<GestureOptions>` when creating a controller.

| Option              | Default | Unit and validation                             |
| ------------------- | ------- | ----------------------------------------------- |
| `distanceThreshold` | 80      | CSS pixels; finite and positive                 |
| `velocityThreshold` | 0.5     | CSS pixels per millisecond; finite and positive |
| `axisLockThreshold` | 8       | CSS pixels; finite and positive                 |
| `animationDuration` | 300     | Milliseconds; finite and nonnegative            |
| `edgeResistance`    | 0.35    | Finite ratio in `[0, 1]`                        |

Velocity uses a bounded recent history and accounts for reversals and pauses. Pointer cancellation or capture loss rolls back. Resize and valid grid replacement cancel the old transaction and invalidate stale animation completions.

## Framework adapters

Framework integrations are isolated packages with peer dependencies:

- [@tikitaki/react](./packages/react/README.md): one parent React root, `useSyncExternalStore`, and portals. StrictMode setup/cleanup/setup is tested.
- [@tikitaki/angular](./packages/angular/README.md): parent-owned embedded template views, signals, and injector context. The zoneless demo uses AOT compilation.
- [@tikitaki/svelte](./packages/svelte/README.md): keyed Svelte 5 components, a readonly store, and owned portals under one parent application.
- [@tikitaki/vue](./packages/vue/README.md): Composition API, a readonly shallow cell store, and Teleport inside the parent application.

Create one adapter per engine view. React and Vue use parent-tree portals, Svelte uses a keyed template with a portal action, and Angular uses parent-owned embedded template views. Pass the adapter to `createSwipeEngine`. Adapters retain context and component state for surviving hosts. They do not create a separate framework root per cell.

The plain DOM `renderCell` callback and `adapter` are mutually exclusive. Framework components must be mounted through an adapter rather than converted to an HTMLElement. Core promises synchronize hosts and adapter snapshots; framework content settles during the framework commit. Use async React `act` or Vue `nextTick` when asserting component content.

## Demos

```sh
npm ci
npm run demo
```

The demos use locally bundled Bootstrap 6.0.0-alpha.1 CSS from the official release tag, with responsive columns, cards, utility classes, and theme-aware buttons. Bootstrap JavaScript is not included.

Open `/react/`, `/vue/`, `/svelte/`, or `/angular/` at the Vite address printed in the terminal. All four demos show a left-aligned 9:16 portrait swipe field with live component counters. Swipe or use the mouse wheel over a cell to navigate; the former control panel has been removed. Wheel down opens the next row, wheel up opens the previous row, always at its first cell after a successful transition. The interactive cell map beside each view (below it on narrow screens) highlights the committed cell and supports pointer selection and keyboard activation.

```sh
npm run demo:build
npm run demo:preview
```

The production demos are generated in `demos/dist`. React uses separate App, EngineView, Cell, and CellMap JSX components in `.tsx` under StrictMode; Vue uses `.vue` single-file components with `<script setup lang="ts">`, templates, and Teleports. Svelte uses runes and `.svelte` component templates; Angular uses signals, standalone components, and separate HTML templates. All pair engine creation with framework cleanup. `npm run typecheck` runs vue-tsc, svelte-check, and ngc with strict template checking. Angular demo classes are the only exception to the functional source rule; the core and adapters remain functional.

## Development and validation

Dependencies are development-only and locked in `package-lock.json`. The verified environment uses Node.js 24 and npm 11.

| Command                  | Purpose                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| `npm test`               | Unit and integration tests                                                     |
| `npm run typecheck`      | Strict TypeScript, including unchecked indexes and exact optional properties   |
| `npm run lint`           | Type-aware ESLint and functional source rules                                  |
| `npm run format`         | Format project files with Prettier 3.9.10                                      |
| `npm run format:check`   | Check Prettier formatting                                                      |
| `npm run build`          | Build core and all optional adapters with declarations and source maps         |
| `npm run build:core`     | Build only the zero-dependency core                                            |
| `npm run build:adapters` | Build adapters after core declarations exist                                   |
| `npm run test:browser`   | Build packages/demos and run installed Google Chrome with mouse/touch projects |
| `npm run test:package`   | Pack, install, compile, and import an independent core consumer                |
| `npm run check`          | Run the aggregate validation sequence                                          |

Prettier 3.9.10 is pinned as a development dependency and controls all formatting, including imports, function signatures, and returns. There is no custom formatting postprocessor. Run `npm run format` before committing; CI runs `npm run format:check`. Generated files, third-party Bootstrap assets, and the mandatory AGENTS.md specification are excluded. English JSDoc describes factories, operations, ownership, units, and validation.

## GitHub Actions and Pages

[The workflow](.github/workflows/ci-pages.yml) follows the AvaWeather repository's structure: `build-and-test → prepare-release → web-pages → release`. It runs on pull requests, pushes to `main`, and manual dispatch. Node.js 24 installs the lockfile with `npm ci`, then runs typecheck, ESLint, formatting checks, unit/integration tests, production library and adapter builds, and the independent packaged-core consumer audit. It builds the demos and runs Google Chrome E2E in desktop and touch configurations, including navigation from the Pages home page to all framework demos under `/TikiTaki/`. Hosted runners use their installed Google Chrome when available.

Only successful tests and builds on `main` allow release preparation and Pages publication. Jobs exchange the exact demo artifact verified by Chrome. Pull requests never deploy or create releases. Failure screenshots, traces, and the Chrome JSON report are retained as workflow artifacts for seven days. The CI badge reports the complete test/build/release pipeline. The release badge is an SVG stored in this repository and updated by the release job together with README. Published deployments are regular GitHub Releases marked **Latest**, so the newest version appears in the repository sidebar and at `releases/latest`; the version string still identifies the alpha package.

One workflow-level concurrency group covers the repository and branch with `cancel-in-progress: true`. A new commit cancels the entire earlier pipeline, including tests, builds, deployment, and release work. There are no cross-workflow completion events to restart an outdated pipeline.

Every deployment stamps `version.json` with a unique semantic prerelease, for example `0.1.0-alpha.0.deploy.7.1`. The final two numbers are the workflow run number and attempt, so rerunning only the Pages job also changes the version. The source commit is recorded alongside it. All five demo pages display the version. After successful Pages deployment, the release job creates a matching `v…` tag and [GitHub Release](https://github.com/gagarinbefree/TikiTaki/releases) at the tested commit, attaching `tikitaki-demo.zip`, the demo link, and `version.json`. It then updates the marked latest-release line in README with a `[skip ci]` bot commit, as in AvaWeather. This update is skipped if the branch has already advanced. Failed deployments do not create releases. Only metadata changes after Chrome verification; application assets are the exact tested artifact. Local development displays `Version: development`. The npm package version remains under explicit release control; no npm packages are published.

The production base path is configured in `DEPLOYMENT_CONFIG` in `tooling.config.mjs`; development keeps `/`. Change the production base path if the repository is renamed. The expected published address is [gagarinbefree.github.io/TikiTaki](https://gagarinbefree.github.io/TikiTaki/), with `react/`, `vue/`, `svelte/`, and `angular/` demos below it. This address becomes available after the first successful deployment.

For initial repository setup, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**. Allow the `github-pages` environment to deploy from `main`. No custom deployment secret is required: only the deployment job receives `pages: write` and `id-token: write` permissions. See the official [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite deployment guide](https://vite.dev/guide/static-deploy.html#github-pages).

TypeScript source imports omit `.js`. Build-time compiler transformers emit explicit JavaScript specifiers in ESM and declarations, so installed packages work with native Node ESM and independent NodeNext consumers without a runtime resolver. Framework dependencies remain outside the core package.

The managed environment can reject nested `spawnSync` calls with `EPERM` in `test:package`. The equivalent pack/install/compile/verify steps are documented in [TESTING.md](./TESTING.md); a blocked aggregate command is never reported as passing.

## Migration and documentation

Replace `new NavigationModel(...)`, `new GestureEngine(...)`, `new DOMRenderer(...)`, and `new SwipeEngine(...)` with their corresponding `create...` factories. The former class names remain interface types; `DOMRenderer` is now a nongeneric handle because its operations do not expose item content.

- [API.md](./API.md): public contracts and promise semantics.
- [ARCHITECTURE.md](./ARCHITECTURE.md): layer boundaries and ownership.
- [TESTING.md](./TESTING.md): actual TDD phases, commands, results, and limitations.
- [AGENTS.md](./AGENTS.md): the unchanged mandatory specification.
