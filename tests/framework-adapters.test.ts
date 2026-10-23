// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createReactCellAdapter } from '../packages/react/src/index';
import { createVueCellAdapter } from '../packages/vue/src/index';
for (const framework of ['react', 'vue'] as const) {
  describe(`${framework} adapter snapshots`, () => {
    function setup() {
      const react = createReactCellAdapter<string>();
      const vue = createVueCellAdapter<string>();
      const result =
        framework === 'react'
          ? { adapter: react.adapter, snapshot: react.getSnapshot }
          : { adapter: vue.adapter, snapshot: () => vue.cells.value };

      return result;
    }
    it('mounts a readonly entry into the given host with copied coordinates', () => {
      const { adapter, snapshot } = setup();
      const host = document.createElement('div');
      const position = { row: 0, col: 9 };
      adapter.mount(host, 'A10', position);
      position.col = 0;
      expect(snapshot()).toHaveLength(1);
      expect(snapshot()[0]).toMatchObject({ host, item: 'A10', position: { row: 0, col: 9 } });
      expect(Object.isFrozen(snapshot())).toBe(true);
      expect(Object.isFrozen(snapshot()[0])).toBe(true);
      expect(Object.isFrozen(snapshot()[0]?.position)).toBe(true);
      expect(host.childNodes).toHaveLength(0);
    });
    it('updates item and coordinates while retaining key and host', () => {
      const { adapter, snapshot } = setup();
      const host = document.createElement('div');
      const handle = adapter.mount(host, 'A1', { row: 0, col: 0 });
      const before = snapshot();
      const key = before[0]?.key;
      handle.update('B1', { row: 1, col: 0 });
      expect(snapshot()).not.toBe(before);
      expect(before[0]?.item).toBe('A1');
      expect(snapshot()[0]).toMatchObject({ key, host, item: 'B1', position: { row: 1, col: 0 } });
    });
    it('unmount is idempotent and stale updates cannot revive a cell', () => {
      const { adapter, snapshot } = setup();
      const handle = adapter.mount(document.createElement('div'), 'A1', { row: 0, col: 0 });
      handle.unmount();
      const empty = snapshot();
      handle.unmount();
      handle.update('ghost', { row: 0, col: 0 });
      expect(snapshot()).toBe(empty);
      expect(snapshot()).toHaveLength(0);
    });
    it('rejects duplicate hosts and uses a fresh key after unmount', () => {
      const { adapter, snapshot } = setup();
      const host = document.createElement('div');
      const handle = adapter.mount(host, 'A1', { row: 0, col: 0 });
      const key = snapshot()[0]?.key;
      expect(() => adapter.mount(host, 'other', { row: 1, col: 0 })).toThrow(TypeError);
      expect(snapshot()).toHaveLength(1);
      handle.unmount();
      adapter.mount(host, 'new', { row: 0, col: 0 });
      expect(snapshot()[0]?.key).not.toBe(key);
    });
    it('isolates bridges and preserves mutable item identity', () => {
      const first = framework === 'react' ? createReactCellAdapter<{ count: number }>() : createVueCellAdapter<{ count: number }>();
      const second = setup();
      const item = { count: 1 };
      first.adapter.mount(document.createElement('div'), item, { row: 0, col: 0 });
      const entry = 'getSnapshot' in first ? first.getSnapshot()[0] : first.cells.value[0];
      expect(entry?.item).toBe(item);
      expect(Object.isFrozen(item)).toBe(false);
      expect(second.snapshot()).toHaveLength(0);
    });
  });
}
it('React subscribers observe committed snapshots and unsubscribe cleanly', () => {
  const bridge = createReactCellAdapter<string>();
  const observations: string[][] = [];
  const unsubscribe = bridge.subscribe(() => {
    observations.push(bridge.getSnapshot().map((cell) => cell.item));
  });
  const handle = bridge.adapter.mount(document.createElement('div'), 'A1', { row: 0, col: 0 });
  handle.update('A2', { row: 0, col: 1 });
  handle.unmount();
  unsubscribe();
  unsubscribe();
  bridge.adapter.mount(document.createElement('div'), 'B1', { row: 1, col: 0 });
  expect(observations).toEqual([['A1'], ['A2'], []]);
});
