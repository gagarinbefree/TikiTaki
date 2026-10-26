// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createAngularCellAdapter, type AngularCellContext, type AngularCellView } from '../packages/angular/src/index';

/**
 * setup
 * @param fail The fail argument.
 * @returns The callback or factory created by this function.
 */
function setup(fail = false) {
  const node = document.createElement('article');
  const views: AngularCellView<string>[] = [];
  const create = vi.fn((context: AngularCellContext<string>) => {
    const view = {
      context,
      rootNodes: [node],
      destroyed: false,
      detectChanges: vi.fn(() => {
        if (fail) throw new Error('render failed');
        node.textContent = context.$implicit;
      }),
      destroy: vi.fn(),
    };
    views.push(view);
    return view;
  });
  const adapter = createAngularCellAdapter(create);
  const host = document.createElement('div');
  return { node, create, adapter, host, views };
}
it('mounts, updates, and releases one parent-owned Angular view without replacing its component', () => {
  const { node, create, adapter, host, views } = setup();
  const position = { row: 0, col: 9 };
  const handle = adapter.mount(host, 'A10', position);
  position.col = 0;
  expect(host.firstChild).toBe(node);
  expect(node.textContent).toBe('A10');
  const view = views[0];
  expect(view?.context.position).toEqual({ row: 0, col: 9 });
  expect(Object.isFrozen(view?.context.position)).toBe(true);
  handle.update('B1', { row: 1, col: 0 });
  expect(node.textContent).toBe('B1');
  expect(create).toHaveBeenCalledTimes(1);
  handle.unmount();
  handle.unmount();
  handle.update('ghost', { row: 0, col: 0 });
  expect(view?.destroy).toHaveBeenCalledTimes(1);
  expect(host.childNodes).toHaveLength(0);
});
it('rejects duplicate hosts and leaves unrelated content untouched during cleanup', () => {
  const { adapter, host } = setup();
  const other = document.createElement('span');
  host.append(other);
  const handle = adapter.mount(host, 'A1', { row: 0, col: 0 });
  expect(() => adapter.mount(host, 'duplicate', { row: 0, col: 0 })).toThrow(TypeError);
  handle.unmount();
  expect(host.firstChild).toBe(other);
  expect(() => adapter.mount(host, 'new', { row: 0, col: 0 })).not.toThrow();
});
it('destroys a failed view and releases its host ownership', () => {
  const { adapter, host, views } = setup(true);
  expect(() => adapter.mount(host, 'bad', { row: 0, col: 0 })).toThrow('render failed');
  expect(views[0]?.destroy).toHaveBeenCalledOnce();
  expect(host.childNodes).toHaveLength(0);
});
