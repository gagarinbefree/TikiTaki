// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { createSvelteCellAdapter, portal } from '../packages/svelte/src/index';

describe('Svelte cell adapter', () => {
  it('publishes immutable entries with copied coordinates and preserves item identity', () => {
    const bridge = createSvelteCellAdapter<{ count: number }>();
    const host = document.createElement('div');
    const position = { row: 0, col: 9 };
    const item = { count: 0 };
    const handle = bridge.adapter.mount(host, item, position);
    const before = get(bridge.cells);
    position.col = 0;
    expect(before[0]).toMatchObject({ host, item, position: { row: 0, col: 9 } });
    expect(Object.isFrozen(before)).toBe(true);
    expect(Object.isFrozen(before[0])).toBe(true);
    expect(Object.isFrozen(before[0]?.position)).toBe(true);
    expect(Object.isFrozen(item)).toBe(false);
    handle.update(item, { row: 1, col: 0 });
    expect(get(bridge.cells)[0]?.key).toBe(before[0]?.key);
    expect(get(bridge.cells)[0]?.item).toBe(item);
    expect(get(bridge.cells)[0]?.position).toEqual({ row: 1, col: 0 });
    handle.unmount();
    const empty = get(bridge.cells);
    handle.unmount();
    handle.update(item, { row: 0, col: 0 });
    expect(get(bridge.cells)).toBe(empty);
    expect(empty).toHaveLength(0);
  });
  it('rejects duplicate hosts and isolates bridges, subscriptions, and stale handles', () => {
    const first = createSvelteCellAdapter<string>();
    const second = createSvelteCellAdapter<string>();
    const host = document.createElement('div');
    const seen: number[] = [];
    const stop = first.cells.subscribe((cells) => {
      seen.push(cells.length);
    });
    const handle = first.adapter.mount(host, 'A1', { row: 0, col: 0 });
    expect(() => first.adapter.mount(host, 'duplicate', { row: 0, col: 0 })).toThrow(TypeError);
    expect(get(second.cells)).toHaveLength(0);
    stop();
    handle.unmount();
    expect(seen).toEqual([0, 1]);
  });
  it('moves only the framework-owned portal node and cleans up idempotently', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const node = document.createElement('article');
    const other = document.createElement('span');
    first.append(other);
    const action = portal(node, first);
    expect(node.parentNode).toBe(first);
    action.update(second);
    expect(node.parentNode).toBe(second);
    expect(first.firstChild).toBe(other);
    action.destroy();
    action.destroy();
    expect(second.childNodes).toHaveLength(0);
    expect(first.firstChild).toBe(other);
  });
});
