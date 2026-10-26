# TikiTaki

[![Tests and build](https://github.com/gagarinbefree/TikiTaki/actions/workflows/npm-publish.yml/badge.svg?branch=main)](https://github.com/gagarinbefree/TikiTaki/actions/workflows/npm-publish.yml)
[![Release](docs/badges/release.svg?version=0.1.14)](https://github.com/gagarinbefree/TikiTaki/releases/latest)
[![npm version](https://img.shields.io/npm/v/tikitaki.svg)](https://www.npmjs.com/package/tikitaki)

[Live demo](https://gagarinbefree.github.io/TikiTaki/) · [Releases](https://github.com/gagarinbefree/TikiTaki/releases) · [Report an issue](https://github.com/gagarinbefree/TikiTaki/issues/new)

[Read the introduction on DEV Community](https://dev.to/gagarinbefree/tikitaki-two-dimensional-swipe-navigation-in-typescript-without-runtime-dependencies-285j)

**Latest release:** <!-- release-version -->v0.1.14<!-- /release-version -->

TikiTaki is a TypeScript library for swipe navigation through a two-dimensional grid whose rows can have different lengths. Use it for paged interfaces, galleries, stories, or component-based feeds. You supply the content; TikiTaki handles navigation, pointer gestures, animation, and cell lifecycle.

The core has **zero runtime dependencies**. It provides ESM exports and TypeScript declarations, with optional React, Vue, Svelte, and Angular adapters. Lit templates integrate through the public rendering adapter contract. Rendering mounts the current cell and valid neighboring cells instead of the entire grid. Multiple independent views are supported.

The project is under active development. Google Chrome Desktop and Chrome touch emulation are tested; physical Android verification is still pending. Other browsers are outside the current support target.

## Install in your project

Install the core in your application:

```sh
npm install tikitaki
```

Choose the installation command for your framework:

| Framework | Installation                                           | TikiTaki integration                                   |
| --------- | ------------------------------------------------------ | ------------------------------------------------------ |
| React     | `npm install tikitaki @tikitaki_gagarinbefree/react`   | Published React adapter                                |
| Vue       | `npm install tikitaki @tikitaki_gagarinbefree/vue`     | Published Vue adapter                                  |
| Svelte    | `npm install tikitaki @tikitaki_gagarinbefree/svelte`  | Published Svelte adapter                               |
| Angular   | `npm install tikitaki @tikitaki_gagarinbefree/angular` | Published Angular adapter                              |
| Lit       | `npm install tikitaki lit`                             | Application-owned adapter using the [Lit recipe](#lit) |

React, Vue, Svelte, and Angular have separate TikiTaki adapter packages. Install only the adapter for your framework; your application supplies its framework peer dependencies. Lit currently uses an application-owned adapter through the core's public `CellAdapter` contract. The `lit` package in its command is the Lit rendering library, not a TikiTaki adapter. There is no published `@tikitaki_gagarinbefree/lit` package.

The [core](https://www.npmjs.com/package/tikitaki) and the four published adapters under [@tikitaki_gagarinbefree](https://www.npmjs.com/org/tikitaki_gagarinbefree) are available from npm. To install an archived build or inspect its contents, use the tested tarballs from [GitHub Releases](https://github.com/gagarinbefree/TikiTaki/releases) or build from source below. Release downloads include an integrity manifest; maintainer publication instructions are in [PUBLISHING.md](./PUBLISHING.md).

### Build from source

Use Node.js 24 and npm 11 for building and contributing. Git and Google Chrome are needed for the contributor workflow and browser tests.

```sh
git clone https://github.com/gagarinbefree/TikiTaki.git
cd TikiTaki
npm ci
npm run build
npm pack
```

For a reproducible integration, check out a release tag before installing dependencies, for example `git checkout v0.1.1`. `npm pack` prints the generated tarball filename. Install that file from your application's directory:

```sh
npm install /absolute/path/to/the-generated-package.tgz
```

CI assigns one version to the core, the four published adapters, and the lockfile before building. Release tarballs carry that exact tested version. Keep the release tag or commit in your integration notes.

For plain TypeScript or JavaScript, the core tarball is sufficient. For Lit, install that same core tarball together with the Lit rendering library in your application:

```sh
npm install /absolute/path/to/the-generated-core-package.tgz lit
```

Then implement the [Lit adapter recipe](#lit), or use the [demo adapter](./demos/lit/cell.ts) as a reference. Lit has no separate TikiTaki adapter tarball or `packages/lit` directory; the demo-local adapter is example source, not a published package.

Packaging commands for each integration, run from the repository root after building:

| Framework | Packaging command             | TikiTaki archives to install                 |
| --------- | ----------------------------- | -------------------------------------------- |
| React     | `npm pack ./packages/react`   | Core + React adapter                         |
| Vue       | `npm pack ./packages/vue`     | Core + Vue adapter                           |
| Svelte    | `npm pack ./packages/svelte`  | Core + Svelte adapter                        |
| Angular   | `npm pack ./packages/angular` | Core + Angular adapter                       |
| Lit       | `npm pack`                    | Core only; install `lit` from npm separately |

Choose the row for your integration. For React, Vue, Svelte, or Angular, install the core tarball and the matching adapter tarball together in the consuming project, with the framework peer dependencies required by its guide. For Lit, use the core-tarball installation command above and the [Lit recipe](#lit); no additional TikiTaki archive is required.

## Quick start: plain TypeScript

Create a container with explicit dimensions:

```html
<div id="swipe-view" style="width: 100%; height: 100dvh"></div>
```

Mount the engine after the container exists:

```ts
import { createSwipeEngine } from 'tikitaki/dom';

const container = document.querySelector<HTMLElement>('#swipe-view');
if (!container) throw new Error('Missing swipe container');

const engine = createSwipeEngine({
  container,
  grid: [['A1', 'A2', 'A3'], ['B1'], ['C1', 'C2']],
  renderCell(item) {
    const element = document.createElement('article');
    element.textContent = item;

    return element;
  },
  onPositionChange(position, previous) {
    console.log('Position changed', previous, position);
  },
  onError(error) {
    console.error('Swipe interaction failed', error);
  },
});

await engine.navigate('up'); // A1 → B1
await engine.goTo({ row: 2, col: 1 }); // B1 → C2
engine.updateGrid([['A1', 'A2'], ['B1']]);

// Call when the owning view is removed.
engine.destroy();
```

The grid must contain at least one row, and every row must contain at least one item. Items can be any type. The engine copies the grid structure while preserving item identity. `initialPosition` defaults to `{ row: 0, col: 0 }`.

Keep the container dedicated to the engine. The DOM controller manages its cell hosts and applies `touch-action: none` locally. Create it on the client; destroy it when the owning route, component, or view unmounts. Bootstrap and the demo styles are not required by the library.

## Navigation and API

Directions describe the swipe, so moving content upward opens the next row:

| Direction | Destination                        |
| --------- | ---------------------------------- |
| `up`      | Next row, always column `0`        |
| `down`    | Previous row, always column `0`    |
| `left`    | Next column in the current row     |
| `right`   | Previous column in the current row |

An unavailable transition preserves the complete position, including the column. Previous row columns are never remembered. A gesture locks to one axis and moves at most one neighboring cell. For example: `A3 → up → B1 → up → C1 → left → C2 → down → B1 → down → A1`.

Mouse-wheel input over a cell also navigates vertically: wheel down opens the next row, wheel up opens the previous row. A wheel burst produces at most one transition; horizontal input and browser zoom gestures are ignored.

| Method                | Contract                                                                     |
| --------------------- | ---------------------------------------------------------------------------- |
| `getPosition()`       | Return a frozen snapshot of the committed position                           |
| `navigate(direction)` | Animate to a neighbor; resolve `true` after the transition commits           |
| `goTo(position)`      | Immediately show a valid target; resolve whether the position changed        |
| `updateGrid(grid)`    | Validate and replace data, cancel motion, and clamp coordinates if necessary |
| `destroy()`           | Release listeners, observers, mounted cells, and animation work; idempotent  |

Navigation promises resolve `false` at boundaries, for the current target, while busy, on cancellation, or after destruction. Commands are not queued. Invalid navigation arguments reject while the controller is alive; invalid grid replacements throw without changing the current grid. Catch promise failures in application event handlers. `onError` reports failures from engine-owned interactions. A throwing position callback can reject its operation after the position has committed.

### Gesture options

Pass overrides through `gesture` when creating the engine, for example `gesture: { animationDuration: 200 }`.

| Option              | Default | Units and accepted values                       |
| ------------------- | ------- | ----------------------------------------------- |
| `distanceThreshold` | `80`    | CSS pixels; finite and positive                 |
| `velocityThreshold` | `0.5`   | CSS pixels per millisecond; finite and positive |
| `axisLockThreshold` | `8`     | CSS pixels; finite and positive                 |
| `animationDuration` | `300`   | Milliseconds; finite and nonnegative            |
| `edgeResistance`    | `0.35`  | Finite ratio from `0` to `1`, inclusive         |

A swipe can commit by distance or velocity. Direction changes and recent motion are taken into account. Pointer cancellation, capture loss, and container resize cancel active motion safely. See [API.md](./API.md) for detailed validation, rendering, and error semantics.

### Headless usage

Use the `tikitaki` entry point for navigation without DOM globals:

```ts
import { createNavigationModel } from 'tikitaki';

const navigation = createNavigationModel([['A1', 'A2'], ['B1']]);
navigation.navigate('up');
console.log(navigation.getPosition()); // { row: 1, col: 0 }
```

`createGestureEngine` is also exported from `tikitaki`. Lower-level DOM integration uses `createDOMRenderer` and `createDOMAdapter` from `tikitaki/dom`. See [ARCHITECTURE.md](./ARCHITECTURE.md) before composing these layers yourself.

## Framework integrations

Use the published adapter for React, Vue, Svelte, or Angular. For Lit, implement the public rendering contract using the recipe below. All integrations keep rendering and cleanup under the owning framework or application:

| Framework | TikiTaki adapter                  | Guide and working example                                               |
| --------- | --------------------------------- | ----------------------------------------------------------------------- |
| React     | `@tikitaki_gagarinbefree/react`   | [Guide](./packages/react/README.md) · [Demo source](./demos/react/)     |
| Vue       | `@tikitaki_gagarinbefree/vue`     | [Guide](./packages/vue/README.md) · [Demo source](./demos/vue/)         |
| Svelte    | `@tikitaki_gagarinbefree/svelte`  | [Guide](./packages/svelte/README.md) · [Demo source](./demos/svelte/)   |
| Angular   | `@tikitaki_gagarinbefree/angular` | [Guide](./packages/angular/README.md) · [Demo source](./demos/angular/) |
| Lit       | Application-owned `CellAdapter`   | [Guide](#lit) · [Demo source](./demos/lit/)                             |

React, Vue, and Svelte factories return a bridge: pass `bridge.adapter` to `createSwipeEngine`. The Angular factory returns a `CellAdapter` directly; the Lit recipe builds one in your application. Pass those objects directly as the `adapter` option. Use `adapter` instead of `renderCell` for these integrations. Keep the adapter stable across component renders, call `updateGrid` when data changes, and destroy the engine during cleanup. The published framework adapters use parent-tree portals, Teleport, or embedded views; Lit renders templates into the supplied cell hosts. Framework components must not be manually converted into an `HTMLElement`. The core does not import any framework.

React StrictMode lifecycle replay is covered by tests. Core navigation promises synchronize hosts and adapter snapshots; framework content still commits on the framework's schedule. Use the framework's rendering helpers when testing component content.

### Lit

Install the core and Lit in your application:

```sh
npm install tikitaki lit
```

Lit uses the public `CellAdapter` contract directly; there is no separate published TikiTaki Lit package. The [working demo](https://gagarinbefree.github.io/TikiTaki/lit/) renders cells and the cell map with Lit templates. See its [cell adapter](./demos/lit/cell.ts) and [map template](./demos/lit/cell-map.ts).

Give the engine a dedicated container with explicit dimensions, as in the plain TypeScript quick start. Render only inside the cell hosts passed to your adapter:

```ts
import { html, nothing, render } from 'lit';
import { createSwipeEngine, type CellAdapter } from 'tikitaki/dom';

const container = document.querySelector<HTMLElement>('#swipe-view');
if (!container) throw new Error('Missing swipe container');

const adapter: CellAdapter<string> = {
  mount(host, item) {
    let destroyed = false;

    /**
     * update
     *
     * Update the Lit template while retaining the engine host.
     * @param nextItem The updated cell data.
     */
    function update(nextItem: string): void {
      if (destroyed) return;
      render(html`<article><h1>${nextItem}</h1></article>`, host);
    }

    update(item);

    return {
      update,
      unmount() {
        if (destroyed) return;
        destroyed = true;
        render(nothing, host);
      },
    };
  },
};

const engine = createSwipeEngine({ container, grid: [['A1', 'A2'], ['B1'], ['C1', 'C2', 'C3']], adapter });
```

Call `engine.updateGrid(nextGrid)` when your data changes. Call `engine.destroy()` when the owning view is removed; this invokes the adapter's cleanup for every mounted cell. If a `LitElement` owns the engine, destroy it in `disconnectedCallback()` and recreate it when the element reconnects. Keep the container's contents under engine ownership; Lit should render cell content only inside the supplied hosts. Any subscriptions added by your adapter must also be released in `unmount()`.

Lit remains an application dependency. The TikiTaki core does not import Lit or any other UI framework.

## Run the demos locally

From a checkout with dependencies installed:

```sh
npm run demo
```

Open the address printed by Vite, then choose Vanilla JS, React, Vue, Svelte, Angular, or Lit. The [Vanilla JS example](./demos/vanilla/) uses the DOM API directly without a UI framework. The [Lit example](./demos/lit/) uses Lit templates for cell rendering and the interactive map, with a demo-local adapter that mounts, updates, and clears each cell template. Lit is a development dependency for the demo; the core package does not depend on it. Each demo starts at A1 and supports swipes, wheel navigation, and an interactive cell map. On phones and tablets in portrait orientation, the swipe view fills the viewport and Bootstrap indicators show the ragged grid as rows of black 2×2 CSS-pixel dots at the bottom, with a 4×4 dot for the current cell. Random swipe backgrounds still use Bootstrap button colors, excluding the inverse (black) theme in mobile portrait mode. This also applies to narrow portrait windows. Landscape orientation always places the swipe view on the left and the labeled map on the right.

```sh
npm run demo:build
npm run demo:preview
```

## Contribute

You can contribute bug reports, reproducible examples, documentation, tests, adapter improvements, and library changes. Repository write access is not required to submit an Issue or a Pull Request. Start with a small, focused change; for substantial features or public API changes, open an Issue first so the approach can be discussed before implementation.

GitHub calls a proposed merge a **Pull Request (PR)**. If you know the term Merge Request (MR), use a PR here.

### Report a bug or propose a feature

Search [existing Issues](https://github.com/gagarinbefree/TikiTaki/issues) and [open Pull Requests](https://github.com/gagarinbefree/TikiTaki/pulls) before creating a duplicate. Then choose **Issues → New issue** or [open an Issue directly](https://github.com/gagarinbefree/TikiTaki/issues/new).

For a bug report, include:

- A clear title describing the observed failure.
- The release tag or commit, browser and operating system, input device, framework, and relevant package versions.
- A minimal runnable reproduction: grid shape, initial coordinates, options, and the exact gesture or command sequence.
- Expected and actual behavior, including the final position.
- Relevant console errors, screenshots, or traces when they help reproduce the problem.

For a feature request, describe the use case, the proposed behavior or API, alternatives considered, and any compatibility concerns. Include only sample data suitable for a public repository. A reproducible report or documentation correction is already a useful contribution; writing code is optional.

### Create a fork and a working branch

1. Click **Fork** on [gagarinbefree/TikiTaki](https://github.com/gagarinbefree/TikiTaki). Keep your fork's `main` available for upstream synchronization.
2. Clone your fork, add the original repository as `upstream`, and branch from its current `main`. Replace `YOUR_USERNAME` below with your GitHub username.

```sh
git clone https://github.com/YOUR_USERNAME/TikiTaki.git
cd TikiTaki
git remote add upstream https://github.com/gagarinbefree/TikiTaki.git
git fetch upstream
git switch main
git merge --ff-only upstream/main
git switch -c fix/vertical-boundary
npm ci
```

Use a descriptive branch name such as `fix/vertical-boundary`, `feat/adapter-update`, or `docs/installation`. Keep one problem or feature per PR. To refresh a working branch later, fetch upstream and merge `upstream/main` into your branch, resolve conflicts, and rerun the relevant checks.

### Implement and validate

Read [AGENTS.md](./AGENTS.md), the project's mandatory specification, and [ARCHITECTURE.md](./ARCHITECTURE.md) before changing behavior. Follow **RED → GREEN → REFACTOR**: reproduce a bug or specify new behavior in a failing test, implement the smallest working change, then refactor while keeping tests green.

Preserve the grid navigation rules and zero-runtime-dependency core. Keep framework dependencies isolated in adapters. Source code uses functional factories, strict TypeScript, extensionless source imports, and English JSDoc. Native Angular demo components are the documented class-based exception. Prettier 3.9.10 owns formatting; run it rather than applying custom formatting rules.

| Command                | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `npm run test:watch`   | Iterate on unit and integration tests                   |
| `npm test`             | Run unit and integration tests                          |
| `npm run typecheck`    | Check TypeScript and Vue, Svelte, and Angular templates |
| `npm run lint`         | Run type-aware ESLint and source rules                  |
| `npm run format`       | Format supported project files                          |
| `npm run format:check` | Verify formatting without rewriting files               |
| `npm run build`        | Build the core and adapters with declarations           |
| `npm run test:package` | Verify builds and an independent packaged consumer      |
| `npm run test:browser` | Build demos and run real Google Chrome E2E              |
| `npm run check`        | Run the aggregate validation sequence                   |

Install Google Chrome before browser checks. For CI-style browser setup, use `npx playwright install --with-deps chrome`; the test configuration explicitly selects Google Chrome. Touch emulation is included, but does not replace testing on a physical Android device. See [TESTING.md](./TESTING.md) for test layers, diagnostics, and environment-specific limitations.

Before requesting review, run `npm run format` and `npm run check`. For documentation-only changes, check formatting and verify links, commands, and examples; report the checks actually performed. CI validates the full project for every PR. Commit source and intentional lockfile changes; leave generated builds, caches, and local diagnostic artifacts out of the PR.

### Open a Pull Request

Push the branch to your fork:

```sh
git add README.md
git commit -m "docs: clarify installation from a local package"
git push -u origin HEAD
```

The command above stages a documentation example; stage the specific source and test files for your own change instead.

On GitHub, open **Compare & pull request**, or use [the comparison page](https://github.com/gagarinbefree/TikiTaki/compare). Select **compare across forks** with:

- **Base repository:** `gagarinbefree/TikiTaki`.
- **Base branch:** `main`.
- **Head repository:** your fork.
- **Compare branch:** your working branch.

Open a **Draft PR** when you want early feedback. Mark it ready for review once the change and validation are complete. Give the PR a specific title and describe:

- The problem or use case and the resulting behavior.
- The related Issue, using `Closes #123` only when merging should resolve it.
- Tests run and their results; include screenshots for visible demo changes.
- Public API changes, compatibility effects, and documentation updates.

Maintainers review the change and its checks before merging. Green CI is necessary, and the maintainer makes the merge decision. Address feedback with further commits on the same branch; they update the existing PR. New commits cancel outdated CI runs for that PR. Once merged, synchronize your fork with upstream and delete the completed feature branch when you no longer need it.

For GitHub UI details, see [GitHub's fork contribution guide](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project) and [creating a PR from a fork](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork).

### Become a contributor

No application or maintainer invitation is needed to start contributing. Pick an Issue, comment with your intended approach to avoid duplicate work, or propose a focused improvement. Help reproduce bugs, improve examples, and review changes as you become familiar with the project. The repository owner decides whether to invite someone to a collaborator or maintainer role; contributing does not automatically grant write access.

## What happens after merge

The [GitHub Actions workflow](./.github/workflows/npm-publish.yml) validates pull requests and pushes to `main`. It runs type checks, lint, formatting, unit/integration tests, package validation, production builds, and Chrome desktop/touch E2E. PR runs do not publish upstream releases or deploy upstream Pages. A new commit cancels the earlier pipeline for the same branch or PR.

After a successful `main` run, the tested demo artifact is deployed to [GitHub Pages](https://gagarinbefree.github.io/TikiTaki/) and a matching [GitHub Release](https://github.com/gagarinbefree/TikiTaki/releases) is created. Stable release versions advance by one patch, such as `v0.1.1` → `v0.1.2`. The release includes the demo archive, `version.json`, npm package tarballs, and their integrity manifest. A bot updates the README badge and package versions. The same run then shows a separate **Publish npm packages** job, which automatically publishes the five verified packages (the core and the React, Vue, Svelte, and Angular adapters) through the trusted publisher. Lit uses the documented application-owned adapter and is not a sixth release package. A manual run remains available for retries. Contributors do not need to edit those generated release fields in feature PRs.

If you want Pages for your own fork, enable Actions, select **Settings → Pages → Source → GitHub Actions**, and allow the `github-pages` environment to deploy from your fork's `main`. If you rename the repository, update `DEPLOYMENT_CONFIG.basePath` in [tooling.config.mjs](./tooling.config.mjs). Fork deployments and releases belong to the fork; upstream releases follow the upstream workflow.

## Reference

- [API.md](./API.md): detailed contracts, validation, and promise semantics.
- [ARCHITECTURE.md](./ARCHITECTURE.md): navigation, gesture, rendering, and adapter boundaries.
- [TESTING.md](./TESTING.md): test strategy, commands, diagnostics, and verification history.
- [AGENTS.md](./AGENTS.md): mandatory implementation specification.

## License

[MIT](./LICENSE), copyright 2026 gagarinbefree. Vendored third-party assets retain their own notices.
