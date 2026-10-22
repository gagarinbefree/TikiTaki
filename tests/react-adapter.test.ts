// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createContext, createElement as h, Fragment, StrictMode, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createSwipeEngine, type SwipeEngine } from '../src/dom';
import type { Grid } from '../src/index';
import { createReactCellAdapter, ReactCellPortals } from '../packages/react/src/index';
import { frameworkEnvironment } from './helpers/framework-environment';
const grid: Grid<string> = [Array.from({ length: 10 }, (_, i) => `A${String(i + 1)}`), ['B1'], ['C1', 'C2']];
const Context = createContext('missing');
async function flush(work: () => void) {
  await act(async () => {
    work();
    await Promise.resolve();
  });
}
let environment: ReturnType<typeof frameworkEnvironment>;
let cleanup: (() => Promise<void>) | undefined;
beforeEach(() => {
  environment = frameworkEnvironment();
});
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  environment.restore();
  document.body.replaceChildren();
});
async function setup(strict = false) {
  const parent = document.createElement('div');
  document.body.append(parent);
  const root = createRoot(parent);
  const bridge = createReactCellAdapter<string>();
  const mounted: string[] = [],
    unmounted: string[] = [];
  const engines: SwipeEngine<string>[] = [];
  const changes = vi.fn();
  function Cell({ item }: { readonly item: string }) {
    const context = useContext(Context);
    const [count, setCount] = useState(0);
    useEffect(() => {
      mounted.push(item);
      const result = () => {
        unmounted.push(item);
      };

      return result;

    }, []);
    const result = h(
      'button',
      {
        onClick: () => {
          setCount((value) => value + 1);
        },
      },
      `${context}:${item}:${String(count)}`,
    );

    return result;

  }
  function App() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      assert(ref.current !== null);
      const engine = createSwipeEngine({
        container: ref.current,
        grid,
        initialPosition: { row: 0, col: 9 },
        adapter: bridge.adapter,
        gesture: { animationDuration: 100 },
        onPositionChange: changes,
      });
      engines.push(engine);
      const result = () => {
        engine.destroy();
      };

      return result;

    }, []);
    const result = h(
      Context.Provider,
      { value: 'parent' },
      h(
        Fragment,
        null,
        h('div', { ref, 'data-container': '' }),
        h(ReactCellPortals<string>, { bridge, renderCell: (item) => h(Cell, { item }) }),
      ),
    );

    return result;

  }
  let alive = true;
  cleanup = async () => {
    if (alive) {
      alive = false;
      await flush(() => {
        root.unmount();
      });
    }
  };
  await flush(() => {
    root.render(strict ? h(StrictMode, null, h(App)) : h(App));
  });
  const container = parent.querySelector<HTMLElement>('[data-container]');
  assert(container !== null);
  const engine = engines.at(-1);
  assert(engine !== undefined);
  const current = () => container.querySelector<HTMLElement>('[data-tikitaki-role="current"]');
  const result = { parent, root, bridge, mounted, unmounted, engines, changes, container, engine, current };

  return result;

}
describe('React parent-root portals', () => {
  it('inherits context and renders only the existing window as interactive components', async () => {
    const app = await setup();
    expect(app.bridge.getSnapshot()).toHaveLength(3);
    expect(app.current()?.textContent).toBe('parent:A10:0');
    const button = app.current()?.querySelector('button');
    assert(button !== null && button !== undefined);
    await flush(() => {
      button.click();
    });
    expect(app.current()?.textContent).toBe('parent:A10:1');
    expect(app.mounted).toHaveLength(3);
  });
  it('updates props without losing component state at surviving coordinates', async () => {
    const app = await setup();
    const host = app.current();
    await flush(() => {
      host?.querySelector('button')?.click();
    });
    await flush(() => {
      app.engine.updateGrid(grid.map((row) => row.map((item) => `${item}!`)));
    });
    expect(app.current()).toBe(host);
    expect(app.current()?.textContent).toBe('parent:A10!:1');
    expect(app.mounted).toHaveLength(3);
    expect(app.unmounted).toHaveLength(0);
  });
  it('keeps a mounted neighbor when it becomes current and resets vertical columns', async () => {
    const app = await setup();
    const neighbor = app.container.querySelector('[data-tikitaki-role="up"]');
    let result: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      result = app.engine.navigate('up');
      await environment.finish();
    });
    expect(await result).toBe(true);
    expect(app.current()).toBe(neighbor);
    expect(app.current()?.textContent).toBe('parent:B1:0');
    expect(await app.engine.navigate('left')).toBe(false);
    await act(async () => {
      result = app.engine.navigate('down');
      await environment.finish();
    });
    expect(await result).toBe(true);
    expect(app.current()?.textContent).toBe('parent:A1:0');
    expect(app.changes).toHaveBeenCalledTimes(2);
  });
  it('destroy cancels pending work and unmounts every portal once after React flush', async () => {
    const app = await setup();
    const pending = app.engine.navigate('up');
    await flush(() => {
      app.engine.destroy();
      app.engine.destroy();
    });
    expect(await pending).toBe(false);
    expect(app.bridge.getSnapshot()).toHaveLength(0);
    expect(app.container.childNodes).toHaveLength(0);
    expect(app.unmounted.sort()).toEqual(app.mounted.sort());
    expect(environment.frames.size).toBe(0);
  });
  it('StrictMode setup/cleanup/setup leaves one engine and pairs every component lifecycle', async () => {
    const errors = vi.spyOn(console, 'error');
    const app = await setup(true);
    expect(app.engines).toHaveLength(2);
    expect(await app.engines[0]?.navigate('up')).toBe(false);
    expect(app.container.querySelectorAll('[data-tikitaki-viewport]')).toHaveLength(1);
    expect(app.bridge.getSnapshot()).toHaveLength(3);
    await flush(() => {
      app.engine.updateGrid([['new']]);
    });
    expect(app.current()?.textContent).toBe('parent:new:0');
    await cleanup?.();
    expect(app.bridge.getSnapshot()).toHaveLength(0);
    expect(app.unmounted.sort()).toEqual(app.mounted.sort());
    expect(environment.observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });
  it('a parent unmount during animation cleans the engine and supports a fresh mount', async () => {
    const app = await setup();
    const pending = app.engine.navigate('up');
    await cleanup?.();
    expect(await pending).toBe(false);
    expect(app.bridge.getSnapshot()).toHaveLength(0);
    expect(app.unmounted.sort()).toEqual(app.mounted.sort());
    const next = await setup();
    expect(next.current()?.textContent).toBe('parent:A10:0');
  });
});
