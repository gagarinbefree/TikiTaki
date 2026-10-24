---
title: 'TikiTaki: two-dimensional swipe navigation in TypeScript, without runtime dependencies'
published: false
tags: typescript, javascript, webdev, opensource
description: Build swipe interfaces with rows of different lengths using a dependency-free TypeScript core and optional framework adapters.
---

Most swipe interfaces move along one axis. But what if each vertical section also contains its own horizontal collection?

Think of a portfolio with projects arranged by category, a fullscreen catalog, or a gallery where each row tells a different story.

I’m building **TikiTaki**, an open-source TypeScript library for this kind of navigation: swipe vertically between rows and horizontally between items.

The core has **zero runtime dependencies**, with separate adapters for React, Vue, Svelte, and Angular.

**[Try the live demo](https://gagarinbefree.github.io/TikiTaki/)** · **[GitHub](https://github.com/gagarinbefree/TikiTaki)** · **[npm](https://www.npmjs.com/package/tikitaki)**

## The grid does not have to be rectangular

Rows can contain different numbers of items:

```ts
const grid = [['A1', 'A2', 'A3'], ['B1'], ['C1', 'C2']];
```

The navigation rules are deliberately predictable:

- Swipe left or right to move within the current row.
- Swipe up or down to change rows.
- A successful vertical transition always opens the first item.
- An unavailable transition preserves the entire current position.
- One gesture moves at most one neighboring cell.

For example:

```text
A3 → swipe up → B1
B1 → swipe up → C1
C1 → swipe left → C2
C2 → swipe down → B1
B1 → swipe down → A1
```

Returning to a row does not restore its previous column. This makes vertical navigation independent of the lengths of neighboring rows.

## A minimal integration

Install the core package:

```sh
npm install tikitaki
```

Give the engine a dedicated container with explicit dimensions:

```html
<div id="swipe-view" style="width: 100%; height: 100dvh"></div>
```

Then create the engine after the container exists:

```ts
import { createSwipeEngine } from 'tikitaki/dom';

const container = document.querySelector<HTMLElement>('#swipe-view');

if (!container) {
  throw new Error('Missing swipe container');
}

const engine = createSwipeEngine({
  container,
  grid: [['A1', 'A2', 'A3'], ['B1'], ['C1', 'C2']],

  renderCell(item) {
    const element = document.createElement('article');
    element.textContent = item;

    return element;
  },

  onPositionChange(position, previous) {
    console.log('Navigation:', previous, '→', position);
  },

  onError(error) {
    console.error('Swipe interaction failed', error);
  },
});
```

Items can be objects rather than strings. Your renderer decides how to turn each item into content.

When the owning view is removed, release the engine:

```ts
engine.destroy();
```

## Gestures and programmatic navigation

Pointer Events handle mouse, touch, and pen input. After an initial movement threshold, the gesture locks to one axis.

A transition can commit by distance or velocity. An insufficient gesture returns to the current cell, while dragging against a boundary applies resistance.

You can also navigate from application controls:

```ts
const moved = await engine.navigate('up');

console.log(moved); // Whether the transition committed
```

Or jump directly to a valid position:

```ts
await engine.goTo({ row: 2, col: 1 });
```

Commands are not queued while the engine is busy. Navigation can resolve `false`, for example, when a boundary prevents movement or another transition is active.

The demo also supports vertical mouse-wheel navigation.

## Framework components need their own lifecycle

One important architectural decision was keeping framework rendering outside the core.

A React or Vue component cannot simply be converted into an `HTMLElement`. It needs to remain connected to its framework’s rendering tree and lifecycle.

TikiTaki provides separate adapter packages:

```text
@tikitaki_gagarinbefree/react
@tikitaki_gagarinbefree/vue
@tikitaki_gagarinbefree/svelte
@tikitaki_gagarinbefree/angular
```

Install only the adapter your application needs. The core does not import any of these frameworks.

The repository includes examples for all four, plus a plain JavaScript demo.

## Rendering and testing

The engine mounts the current cell and the necessary neighboring cells rather than rendering the entire grid.

Movement uses `requestAnimationFrame` and CSS transforms. Navigation, gesture recognition, and DOM rendering are separate modules.

The project includes unit and integration tests, strict TypeScript checks, and browser tests running in Google Chrome with desktop input and touch emulation.

It is still an early project. Chrome is the current browser target, and testing on a physical Android device remains pending. Touch emulation does not replace that validation.

## What would you build with it?

TikiTaki is available under the MIT license.

I’d appreciate feedback on two things:

- Where would two-dimensional swipe navigation be useful in your application?
- What would make the integration easier for your framework?

You can explore the [live demo](https://gagarinbefree.github.io/TikiTaki/), read the [integration documentation](https://github.com/gagarinbefree/TikiTaki#readme), or [open an issue](https://github.com/gagarinbefree/TikiTaki/issues).

If you try it in a project, I’d love to hear what worked and what got in the way.
