# @tikitaki_gagarinbefree/react

A functional React adapter for TikiTaki. ESM, strict TypeScript, MIT licensed. Peer dependencies: the compatible `tikitaki` version declared in package.json, `react@^19.3.1`, and `react-dom@^19.3.1`. The core package has no framework dependency.

## Usage

Create one bridge per view and render one `ReactCellPortals` under the owning React root. Portals preserve parent context, events, and local component state for surviving hosts. No per-cell roots are created.

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Grid } from 'tikitaki';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import { createReactCellAdapter, ReactCellPortals } from '@tikitaki_gagarinbefree/react';
/** Own one controller while rendering its component content through parent-root portals. */
export function GridView({ grid }: { grid: Grid<string> }) {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<SwipeEngine<string> | null>(null);
  const initialGrid = useRef(grid);
  const [bridge] = useState(createReactCellAdapter<string>);
  useEffect(() => {
    if (!container.current) return;

    const instance = createSwipeEngine({ container: container.current, grid: initialGrid.current, adapter: bridge.adapter });
    engine.current = instance;
    const cleanup = () => {
      engine.current = null;
      instance.destroy();
    };

    return cleanup;
  }, [bridge]);
  useEffect(() => {
    engine.current?.updateGrid(grid);
  }, [grid]);
  const view = (
    <>
      <div ref={container} style={{ height: '100dvh' }} />
      <ReactCellPortals bridge={bridge} renderCell={(item) => <button>{item}</button>} />
    </>
  );

  return view;
}
```

The bridge remains stable across renders and StrictMode replay. Update data through `updateGrid`; do not recreate the controller on every render. Cleanup must destroy the controller. Keep framework children out of the managed container and render them through the Portals component instead. Put hooks in child components, not directly inside `renderCell`.

`bridge.adapter` implements `CellAdapter<T>`. `getSnapshot()` returns a stable immutable cell array until mount/update/unmount; `subscribe(listener)` returns an idempotent unsubscribe function. Records contain a stable key, host, item, and copied readonly position. Item identity is preserved. Unmount is idempotent, and stale handles cannot recreate a removed cell.

Core promises synchronize hosts and adapter snapshots. React content commits on React's schedule; use async `act` in tests. Handle component rendering/effect failures with a parent error boundary and controller failures through promises or `onError`. Create the DOM controller on the client in an effect. Adapter ownership messages are centralized in `src/config.ts`.
