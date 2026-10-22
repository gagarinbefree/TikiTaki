// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, Fragment, h, inject, nextTick, onMounted, onUnmounted, provide, ref } from 'vue';
import { createSwipeEngine, type SwipeEngine } from '../src/dom';
import type { Grid } from '../src/index';
import { createVueCellAdapter, VueCellPortals } from '../packages/vue/src/index';
import { frameworkEnvironment } from './helpers/framework-environment';
const grid: Grid<string> = [Array.from({ length: 10 }, (_, i) => `A${String(i + 1)}`), ['B1'], ['C1', 'C2']];
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
async function setup() {
  const parent = document.createElement('div');
  document.body.append(parent);
  const bridge = createVueCellAdapter<string>();
  const mounted: string[] = [],
    unmounted: string[] = [];
  const errors = vi.fn();
  const changes = vi.fn();
  const engines: SwipeEngine<string>[] = [];
  const Cell = defineComponent({
    props: { item: { type: String, required: true } },
    setup(props) {
      const context = inject<string>('context', 'missing');
      const count = ref(0);
      const initial = props.item;
      onMounted(() => {
        mounted.push(initial);
      });
      onUnmounted(() => {
        unmounted.push(initial);
      });
      const result = () => h(
          'button',
          {
            onClick: () => {
              count.value++;
            },
          },
          `${context}:${props.item}:${String(count.value)}`,
        );

      return result;

    },
  });
  const App = defineComponent({
    setup() {
      const container = ref<HTMLElement | null>(null);
      provide('context', 'parent');
      onMounted(() => {
        assert(container.value !== null);
        engines.push(
          createSwipeEngine({
            container: container.value,
            grid,
            initialPosition: { row: 0, col: 9 },
            adapter: bridge.adapter,
            gesture: { animationDuration: 100 },
            onPositionChange: changes,
          }),
        );
      });
      onUnmounted(() => {
        engines.at(-1)?.destroy();
      });
      const result = () => h(Fragment, [
          h('div', { ref: container, 'data-container': '' }),
          h(VueCellPortals<string>, { bridge, renderCell: (item: string) => h(Cell, { item }) }),
        ]);

      return result;

    },
  });
  const app = createApp(App);
  app.config.errorHandler = errors;
  let alive = true;
  cleanup = async () => {
    if (alive) {
      alive = false;
      app.unmount();
      await nextTick();
    }
  };
  app.mount(parent);
  await nextTick();
  const container = parent.querySelector<HTMLElement>('[data-container]');
  assert(container !== null);
  const engine = engines.at(-1);
  assert(engine !== undefined);
  const current = () => container.querySelector<HTMLElement>('[data-tikitaki-role="current"]');
  const result = { parent, app, bridge, mounted, unmounted, errors, changes, container, engine, current };

  return result;

}
describe('Vue parent-app Teleports', () => {
  it('inherits provide/inject and renders only valid interactive neighbors', async () => {
    const app = await setup();
    expect(app.bridge.cells.value).toHaveLength(3);
    expect(app.current()?.textContent).toBe('parent:A10:0');
    app.current()?.querySelector('button')?.click();
    await nextTick();
    expect(app.current()?.textContent).toBe('parent:A10:1');
    expect(app.mounted).toHaveLength(3);
    expect(app.errors).not.toHaveBeenCalled();
  });
  it('updates component props without losing state or host identity', async () => {
    const app = await setup();
    const host = app.current();
    host?.querySelector('button')?.click();
    await nextTick();
    app.engine.updateGrid(grid.map((row) => row.map((item) => `${item}!`)));
    await nextTick();
    expect(app.current()).toBe(host);
    expect(app.current()?.textContent).toBe('parent:A10!:1');
    expect(app.mounted).toHaveLength(3);
    expect(app.unmounted).toHaveLength(0);
    expect(app.errors).not.toHaveBeenCalled();
  });
  it('reuses an incoming component on navigation and opens col 0 on vertical return', async () => {
    const app = await setup();
    const neighbor = app.container.querySelector('[data-tikitaki-role="up"]');
    const up = app.engine.navigate('up');
    await environment.finish();
    await nextTick();
    expect(await up).toBe(true);
    expect(app.current()).toBe(neighbor);
    expect(app.current()?.textContent).toBe('parent:B1:0');
    expect(await app.engine.navigate('left')).toBe(false);
    const down = app.engine.navigate('down');
    await environment.finish();
    await nextTick();
    expect(await down).toBe(true);
    expect(app.current()?.textContent).toBe('parent:A1:0');
    expect(app.changes).toHaveBeenCalledTimes(2);
    expect(app.errors).not.toHaveBeenCalled();
  });
  it('destroy cancels animation and unmounts every component exactly once', async () => {
    const app = await setup();
    const pending = app.engine.navigate('up');
    app.engine.destroy();
    app.engine.destroy();
    await nextTick();
    expect(await pending).toBe(false);
    expect(app.bridge.cells.value).toHaveLength(0);
    expect(app.container.childNodes).toHaveLength(0);
    expect(app.unmounted.sort()).toEqual(app.mounted.sort());
    expect(environment.frames.size).toBe(0);
    expect(app.errors).not.toHaveBeenCalled();
  });
  it('parent unmount during animation cleans resources and permits reinitialization', async () => {
    const app = await setup();
    const pending = app.engine.navigate('up');
    await cleanup?.();
    expect(await pending).toBe(false);
    expect(app.bridge.cells.value).toHaveLength(0);
    expect(app.unmounted.sort()).toEqual(app.mounted.sort());
    expect(environment.observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true);
    expect(app.errors).not.toHaveBeenCalled();
    const next = await setup();
    expect(next.current()?.textContent).toBe('parent:A10:0');
  });
  it('clamps replacement grids and handles repeated mount/update/destroy cycles', async () => {
    const app = await setup();
    for (let i = 0; i < 20; i++) {
      app.engine.updateGrid(i % 2 === 0 ? [['only']] : grid);
      await nextTick();
      expect(app.bridge.cells.value.length).toBeLessThanOrEqual(5);
      expect(app.current()?.textContent).toBe(i % 2 === 0 ? 'parent:only:0' : 'parent:A1:0');
    }
    await cleanup?.();
    expect(app.unmounted.sort()).toEqual(app.mounted.sort());
    expect(app.errors).not.toHaveBeenCalled();
  });
});
