import { createResizeObserverMock } from './helpers/resize-observer';
// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDOMRenderer, type DOMRenderer, createDOMAdapter } from '../src/dom';
import type { CellAdapter, MountedCell, NavigationSource } from '../src/dom';
import { createNavigationModel } from '../src/index';
import type { Direction, GestureSettlement, Position } from '../src/index';
const TestObserver = createResizeObserverMock();
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let renderers: DOMRenderer[];
function frame(time = 0) {
  const scheduled = [...frames.values()];
  frames.clear();
  for (const callback of scheduled) callback(time);
}
function viewport(width = 300, height = 600) {
  const container = document.createElement('div');
  const size = { width, height };
  const readWidth = vi.fn(() => size.width);
  const readHeight = vi.fn(() => size.height);
  Object.defineProperties(container, {
    clientWidth: { configurable: true, get: readWidth },
    clientHeight: { configurable: true, get: readHeight },
  });
  document.body.append(container);
  const result = { container, size, readWidth, readHeight };

  return result;
}
function adapter() {
  const records: {
    host: HTMLElement;
    position: Position;
    update: ReturnType<typeof vi.fn<MountedCell<string>['update']>>;
    unmount: ReturnType<typeof vi.fn<MountedCell<string>['unmount']>>;
  }[] = [];
  const mount = vi.fn<CellAdapter<string>['mount']>((host, item, position) => {
    const content = document.createElement('span');
    content.textContent = item;
    host.append(content);
    const update = vi.fn<MountedCell<string>['update']>((next) => {
      content.textContent = next;
    });
    const unmount = vi.fn<MountedCell<string>['unmount']>();
    records.push({ host, position, update, unmount });
    const result = { update, unmount };

    return result;
  });
  const result = { mount, records };

  return result;
}
function setup(position: Position = { row: 0, col: 9 }) {
  const view = viewport();
  const model = createNavigationModel<string>(
    [['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'], ['B1'], ['C1', 'C2', 'C3'], ['D1', 'D2']],
    position,
  );
  const cells = adapter();
  const renderer = createDOMRenderer({ container: view.container, navigation: model, adapter: cells });
  renderers.push(renderer);
  const result = { ...view, model, cells, renderer };

  return result;
}
function cell(container: HTMLElement, role: 'current' | Direction): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-tikitaki-role="${role}"]`);
  assert(element !== null);

  return element;
}
function plan(direction: Direction | null = 'up', duration = 300): GestureSettlement {
  const result: GestureSettlement = { direction, from: { x: 0, y: -100 }, to: { x: 0, y: direction === null ? 0 : -600 }, duration };

  return result;
}
beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  renderers = [];
  TestObserver.instances = [];
  vi.stubGlobal('ResizeObserver', TestObserver.construct);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);

    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});
afterEach(() => {
  for (const renderer of renderers) renderer.destroy();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
describe('DOMRenderer window and ownership', () => {
  it('sets the new role and inert state before the adapter update lifecycle', () => {
    const { renderer, model, cells } = setup();
    const target = cells.records[1];
    assert(target !== undefined);
    const seen: { role: string | undefined; inert: boolean }[] = [];
    target.update.mockImplementation(() => {
      seen.push({ role: target.host.dataset.tikitakiRole, inert: target.host.inert });
    });
    model.navigate('up');
    renderer.sync();
    expect(seen).toEqual([{ role: 'current', inert: false }]);
  });
  it('blocks reentrant movement and animation from adapter lifecycle callbacks', async () => {
    const { renderer, cells, container } = setup();
    let moved: boolean | undefined;
    let animated: Promise<boolean> | undefined;
    cells.records[0]?.update.mockImplementation(() => {
      moved = renderer.setOffset({ x: 0, y: -20 });
      animated = renderer.animate(plan());
    });
    renderer.sync();
    expect(moved).toBe(false);
    await expect(animated).resolves.toBe(false);
    expect(frames.size).toBe(0);
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, 0px, 0px)');
  });
  it('mounts A10 and only existing A9/B1 neighbors, with correct geometry', () => {
    const { container, cells, renderer } = setup();
    expect(cells.mount).toHaveBeenCalledTimes(3);
    expect(cells.records.map((entry) => entry.position)).toEqual([
      { row: 0, col: 9 },
      { row: 1, col: 0 },
      { row: 0, col: 8 },
    ]);
    expect(cell(container, 'current').textContent).toBe('A10');
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, 0px, 0px)');
    expect(cell(container, 'up').textContent).toBe('B1');
    expect(cell(container, 'up').style.transform).toBe('translate3d(0px, 600px, 0px)');
    expect(cell(container, 'right').textContent).toBe('A9');
    expect(cell(container, 'right').style.transform).toBe('translate3d(-300px, 0px, 0px)');
    expect(container.querySelector('[data-tikitaki-role="down"]')).toBeNull();
    expect(container.querySelector('[data-tikitaki-role="left"]')).toBeNull();
    expect(renderer.getSize()).toEqual({ width: 300, height: 600 });
    expect(Object.isFrozen(renderer.getSize())).toBe(true);
    expect(TestObserver.instances[0]?.observe).toHaveBeenCalledWith(container);
  });
  it('renders at most five cells from a very large grid', () => {
    const { container } = viewport();
    const model = createNavigationModel(
      Array.from({ length: 100 }, () => Array.from({ length: 100 }, () => 'cell')),
      { row: 50, col: 50 },
    );
    const getItem = vi.spyOn(model, 'getItem');
    const cells = adapter();
    const renderer = createDOMRenderer({ container, navigation: model, adapter: cells });
    renderers.push(renderer);
    expect(cells.mount).toHaveBeenCalledTimes(5);
    expect(getItem).toHaveBeenCalledTimes(5);
    expect(container.querySelectorAll('[data-tikitaki-cell]')).toHaveLength(5);
    expect(cells.records.filter((entry) => entry.position.row !== 50).map((entry) => entry.position.col)).toEqual([0, 0]);
  });
  it('reuses surviving hosts, updates content, and unmounts cells leaving the window', () => {
    const { container, model, renderer, cells } = setup();
    const target = cell(container, 'up');
    model.navigate('up');
    renderer.sync();
    expect(cell(container, 'current')).toBe(target);
    expect(cell(container, 'current').textContent).toBe('B1');
    expect(cell(container, 'down').textContent).toBe('A1');
    expect(cell(container, 'up').textContent).toBe('C1');
    expect(container.querySelectorAll('[data-tikitaki-cell]')).toHaveLength(3);
    expect(cells.records[0]?.unmount).toHaveBeenCalledTimes(1);
    expect(cells.records[2]?.unmount).toHaveBeenCalledTimes(1);
    expect(cells.records[1]?.update).toHaveBeenCalledWith('B1', { row: 1, col: 0 });
    model.updateGrid([['X1'], ['Y1']]);
    renderer.sync();
    expect(cell(container, 'current')).toBe(target);
    expect(target.textContent).toBe('Y1');
    expect(container.querySelectorAll('[data-tikitaki-cell]')).toHaveLength(2);
  });
  it('updates retained cells even when an object item identity has not changed', () => {
    const { container } = viewport();
    const item = { label: 'before' };
    const model = createNavigationModel([[item]]);
    const render = createDOMAdapter<{ label: string }>((value) => {
      const element = document.createElement('div');
      element.textContent = value.label;

      return element;
    });
    const renderer = createDOMRenderer({ container, navigation: model, adapter: render });
    item.label = 'after';
    renderer.sync();
    expect(cell(container, 'current').textContent).toBe('after');
    renderer.destroy();
  });
  it('does not modify adapter-owned descendants or existing container content', () => {
    const { container } = viewport();
    const existing = document.createElement('aside');
    existing.textContent = 'existing';
    container.append(existing);
    const style = document.createElement('style');
    document.head.append(style);
    const renderer = createDOMRenderer({
      container,
      navigation: createNavigationModel([['only']]),
      adapter: createDOMAdapter(() => {
        const content = document.createElement('button');
        content.style.transform = 'rotate(10deg)';

        return content;
      }),
    });
    const button = cell(container, 'current').firstElementChild;
    assert(button instanceof HTMLElement);
    const contentStyle = button.style.cssText;
    renderer.setOffset({ x: 20, y: 0 });
    frame();
    expect(button.style.cssText).toBe(contentStyle);
    expect(existing.parentNode).toBe(container);
    expect(style.textContent).toBe('');
    renderer.destroy();
    expect([...container.children]).toEqual([existing]);
    style.remove();
  });
  it('isolates offscreen neighbors from focus and accessibility', () => {
    const { container } = setup();
    expect(cell(container, 'current').inert).toBe(false);
    expect(cell(container, 'current').getAttribute('aria-hidden')).toBe('false');
    expect(cell(container, 'up').inert).toBe(true);
    expect(cell(container, 'up').getAttribute('aria-hidden')).toBe('true');
  });
  it('restores managed inline styles and their priorities on destroy', () => {
    const { container } = viewport();
    container.style.setProperty('overflow', 'auto', 'important');
    container.style.setProperty('touch-action', 'pan-y');
    container.style.color = 'red';
    const original = container.style.cssText;
    const renderer = createDOMRenderer({ container, navigation: createNavigationModel([['only']]), adapter: adapter() });
    expect(container.style.overflow).toBe('hidden');
    expect(container.style.touchAction).toBe('none');
    renderer.destroy();
    renderer.destroy();
    expect(container.style.cssText).toBe(original);
    expect(container.children).toHaveLength(0);
    expect(TestObserver.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });
  it('preserves positioned containers and user style changes made during ownership', () => {
    const { container } = viewport();
    container.style.position = 'absolute';
    const renderer = createDOMRenderer({ container, navigation: createNavigationModel([['only']]), adapter: adapter() });
    expect(container.style.position).toBe('absolute');
    container.style.overflow = 'clip';
    renderer.destroy();
    expect(container.style.position).toBe('absolute');
    expect(container.style.overflow).toBe('clip');
  });
  it('prevents concurrent ownership of one container and allows reinitialization', () => {
    const { container, renderer } = setup();
    expect(() => createDOMRenderer({ container, navigation: createNavigationModel([['other']]), adapter: adapter() })).toThrow();
    expect(cell(container, 'current').textContent).toBe('A10');
    renderer.destroy();
    const fresh = createDOMRenderer({ container, navigation: createNavigationModel([['fresh']]), adapter: adapter() });
    renderers.push(fresh);
    expect(cell(container, 'current').textContent).toBe('fresh');
  });
});
describe('RAF drawing and animation', () => {
  it('coalesces movements to one RAF with no layout reads during drag', () => {
    const { renderer, container, readWidth, readHeight } = setup();
    readWidth.mockClear();
    readHeight.mockClear();
    renderer.setOffset({ x: 0, y: -20 });
    renderer.setOffset({ x: 0, y: -80 });
    expect(frames.size).toBe(1);
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, 0px, 0px)');
    frame();
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, -80px, 0px)');
    expect(cell(container, 'up').style.transform).toBe('translate3d(0px, 520px, 0px)');
    expect(readWidth).not.toHaveBeenCalled();
    expect(readHeight).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
  it('animates from the final drag position through intermediate RAF frames', async () => {
    const { renderer, container, model } = setup();
    renderer.setOffset({ x: 0, y: -100 });
    frame();
    const result = renderer.animate(plan());
    frame(0);
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, -100px, 0px)');
    frame(150);
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, -537.5px, 0px)');
    frame(300);
    await expect(result).resolves.toBe(true);
    expect(cell(container, 'up').style.transform).toBe('translate3d(0px, 0px, 0px)');
    const target = cell(container, 'up');
    model.navigate('up');
    renderer.sync();
    expect(cell(container, 'current')).toBe(target);
    expect(target.style.transform).toBe('translate3d(0px, 0px, 0px)');
    expect(frames.size).toBe(0);
  });
  const targets: [Direction, number, number][] = [
    ['up', 0, -600],
    ['down', 0, 600],
    ['left', -300, 0],
    ['right', 300, 0],
  ];
  it.each(targets)('settles in direction %s', async (direction, x, y) => {
    const { renderer, container } = setup({ row: 2, col: 1 });
    const result = renderer.animate({ direction, from: { x: 0, y: 0 }, to: { x, y }, duration: 100 });
    frame(20);
    frame(120);
    await expect(result).resolves.toBe(true);
    expect(cell(container, direction).style.transform).toBe('translate3d(0px, 0px, 0px)');
  });
  it('smoothly returns a cancelled gesture to the origin', async () => {
    const { renderer, container } = setup();
    const result = renderer.animate(plan(null));
    frame(0);
    frame(150);
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, -12.5px, 0px)');
    frame(300);
    await expect(result).resolves.toBe(true);
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, 0px, 0px)');
  });
  it('handles zero-duration animations in one frame', async () => {
    const { renderer, container } = setup();
    const result = renderer.animate(plan('up', 0));
    frame(100);
    await expect(result).resolves.toBe(true);
    expect(cell(container, 'up').style.transform).toBe('translate3d(0px, 0px, 0px)');
    expect(frames.size).toBe(0);
  });
  it('blocks conflicting animations and moves without disturbing the active one', async () => {
    const { renderer } = setup();
    const first = renderer.animate(plan());
    await expect(renderer.animate(plan(null))).resolves.toBe(false);
    expect(renderer.setOffset({ x: 0, y: -10 })).toBe(false);
    frame(0);
    frame(300);
    await expect(first).resolves.toBe(true);
  });
  it.each(['reset', 'sync', 'destroy'] as const)('%s cancels the Promise and all pending RAF work', async (method) => {
    const { renderer, container } = setup();
    const result = renderer.animate(plan());
    frame(0);
    const stale = [...frames.values()];
    renderer[method]();
    await expect(result).resolves.toBe(false);
    expect(frames.size).toBe(0);
    for (const callback of stale) callback(1000);
    expect(frames.size).toBe(0);
    if (method !== 'destroy') {
      expect(cell(container, 'current').style.transform).toBe('translate3d(0px, 0px, 0px)');
    }
  });
  it('does not let a cancelled frame finish or mutate a newer animation', async () => {
    const { renderer, container } = setup();
    const old = renderer.animate(plan());
    frame(0);
    const stale = [...frames.values()];
    renderer.reset();
    await expect(old).resolves.toBe(false);
    const current = renderer.animate(plan(null));
    for (const callback of stale) callback(1000);
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, 0px, 0px)');
    frame(0);
    frame(300);
    await expect(current).resolves.toBe(true);
  });
  it('keeps separate instances and frame queues independent', async () => {
    const first = setup();
    const second = setup();
    const firstResult = first.renderer.animate(plan());
    const secondResult = second.renderer.animate(plan());
    first.renderer.destroy();
    await expect(firstResult).resolves.toBe(false);
    frame(0);
    frame(300);
    await expect(secondResult).resolves.toBe(true);
    expect(cell(second.container, 'up').style.transform).toBe('translate3d(0px, 0px, 0px)');
  });
});
describe('resize, validation, and failure cleanup', () => {
  it('batches ResizeObserver notifications and cancels animation before notifying the owner', async () => {
    const { container, size, readWidth, readHeight } = viewport();
    const onResize = vi.fn();
    const renderer = createDOMRenderer({ container, navigation: createNavigationModel([['A1'], ['B1']]), adapter: adapter(), onResize });
    renderers.push(renderer);
    const result = renderer.animate(plan());
    frame(0);
    readWidth.mockClear();
    readHeight.mockClear();
    size.width = 400;
    size.height = 800;
    TestObserver.instances[0]?.notify();
    TestObserver.instances[0]?.notify();
    frame(100);
    await expect(result).resolves.toBe(false);
    expect(renderer.getSize()).toEqual({ width: 400, height: 800 });
    expect(cell(container, 'up').style.transform).toBe('translate3d(0px, 800px, 0px)');
    expect(onResize).toHaveBeenCalledOnce();
    expect(onResize).toHaveBeenCalledWith({ width: 400, height: 800 });
    expect(readWidth).toHaveBeenCalledOnce();
    expect(readHeight).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
  });
  it('does not interrupt animation for an unchanged resize notification', async () => {
    const { renderer } = setup();
    const result = renderer.animate(plan());
    frame(0);
    TestObserver.instances[0]?.notify();
    frame(100);
    frame(300);
    await expect(result).resolves.toBe(true);
  });
  it('resets dragging on resize and supports initially hidden containers', async () => {
    const { container, size } = viewport(0, 0);
    const renderer = createDOMRenderer({ container, navigation: createNavigationModel([['A'], ['B']]), adapter: adapter() });
    renderers.push(renderer);
    expect(renderer.setOffset({ x: 0, y: -10 })).toBe(false);
    await expect(renderer.animate(plan())).resolves.toBe(false);
    size.width = 300;
    size.height = 600;
    TestObserver.instances[0]?.notify();
    frame();
    expect(renderer.setOffset({ x: 0, y: -50 })).toBe(true);
    frame();
    size.width = 400;
    TestObserver.instances[0]?.notify();
    frame();
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, 0px, 0px)');
  });
  it('destroy ignores queued observer notifications and terminal operations', async () => {
    const { renderer, container } = setup();
    const observer = TestObserver.instances[0];
    renderer.setOffset({ x: 0, y: -30 });
    renderer.destroy();
    observer?.notify();
    frame();
    renderer.sync();
    renderer.reset();
    expect(renderer.setOffset({ x: 0, y: -20 })).toBe(false);
    await expect(renderer.animate(plan())).resolves.toBe(false);
    expect(frames.size).toBe(0);
    expect(container.children).toHaveLength(0);
  });
  it.each([
    { x: NaN, y: 0 },
    { x: 1, y: 1 },
    { x: 301, y: 0 },
  ])('rejects invalid offset %j before changing a pending frame', (offset) => {
    const { renderer, container } = setup();
    renderer.setOffset({ x: 0, y: -30 });
    expect(() => renderer.setOffset(offset)).toThrow(RangeError);
    frame();
    expect(cell(container, 'current').style.transform).toBe('translate3d(0px, -30px, 0px)');
  });
  it.each([
    null,
    { ...plan(), duration: -1 },
    { ...plan(), duration: NaN },
    { ...plan(), to: { x: 0, y: -500 } },
    { ...plan(), from: { x: 20, y: -10 } },
  ])('rejects malformed animation plan %j without starting work', async (input) => {
    const { renderer } = setup();
    await expect(renderer.animate(input as GestureSettlement)).rejects.toThrow();
    expect(frames.size).toBe(0);
  });
  it('returns false for a target with no mounted neighbor', async () => {
    const { renderer } = setup();
    await expect(renderer.animate({ direction: 'left', from: { x: 0, y: 0 }, to: { x: -300, y: 0 }, duration: 100 })).resolves.toBe(false);
  });
  it('cleans up partial mounts and restores styles if constructor mount fails', () => {
    const { container } = viewport();
    const unmount = vi.fn();
    const mount = vi
      .fn<CellAdapter<string>['mount']>()
      .mockReturnValueOnce({ update: vi.fn(), unmount })
      .mockImplementationOnce(() => {
        throw new Error('mount failure');
      });
    expect(() => createDOMRenderer({ container, navigation: createNavigationModel([['A'], ['B']]), adapter: { mount } })).toThrow(
      'mount failure',
    );
    expect(unmount).toHaveBeenCalledOnce();
    expect(container.children).toHaveLength(0);
    expect(container.style.cssText).toBe('');
    expect(frames.size).toBe(0);
  });
  it('finishes all cleanup even if an unmount throws', () => {
    const { renderer, container, cells } = setup();
    cells.records[0]?.unmount.mockImplementationOnce(() => {
      throw new Error('cleanup failure');
    });
    expect(() => {
      renderer.destroy();
    }).toThrow(AggregateError);
    for (const entry of cells.records) expect(entry.unmount).toHaveBeenCalledOnce();
    expect(container.children).toHaveLength(0);
    expect(frames.size).toBe(0);
    expect(TestObserver.instances[0]?.disconnect).toHaveBeenCalledOnce();
    expect(() => {
      renderer.destroy();
    }).not.toThrow();
  });
  it('adapter update failure cancels animation and destroys the inconsistent window', async () => {
    const { renderer, container, cells } = setup();
    const result = renderer.animate(plan());
    cells.records[0]?.update.mockImplementationOnce(() => {
      throw new Error('update failure');
    });
    expect(() => {
      renderer.sync();
    }).toThrow('update failure');
    await expect(result).resolves.toBe(false);
    for (const entry of cells.records) expect(entry.unmount).toHaveBeenCalledOnce();
    expect(container.children).toHaveLength(0);
  });
  it('rejects invalid source snapshots before interrupting current rendering', async () => {
    const { renderer, model, container } = setup();
    const result = renderer.animate(plan());
    vi.spyOn(model, 'getNeighbor').mockReturnValue({ row: 999, col: 999 });
    expect(() => {
      renderer.sync();
    }).toThrow();
    expect(cell(container, 'current').textContent).toBe('A10');
    frame(0);
    frame(300);
    await expect(result).resolves.toBe(true);
  });
  it('rejects malformed construction inputs without touching the container', () => {
    const { container } = viewport();
    const source = createNavigationModel([['A']]);
    expect(() => createDOMRenderer({ container: {} as HTMLElement, navigation: source, adapter: adapter() })).toThrow(TypeError);
    expect(() => createDOMRenderer({ container, navigation: {} as NavigationSource<string>, adapter: adapter() })).toThrow(TypeError);
    expect(() => createDOMRenderer({ container, navigation: source, adapter: {} as CellAdapter<string> })).toThrow(TypeError);
    expect(container.children).toHaveLength(0);
    expect(container.style.cssText).toBe('');
  });
});
describe('plain DOM adapter', () => {
  it('mounts, replaces, and unmounts its own content', () => {
    const host = document.createElement('div');
    const adapter = createDOMAdapter<string>((item) => {
      const element = document.createElement('p');
      element.textContent = item;

      return element;
    });
    const handle = adapter.mount(host, 'before', { row: 0, col: 0 });
    const previous = host.firstElementChild;
    handle.update('after', { row: 0, col: 0 });
    expect(host.textContent).toBe('after');
    expect(previous?.parentNode).toBeNull();
    handle.unmount();
    handle.unmount();
    expect(host.children).toHaveLength(0);
  });
  it('rejects non-elements and elements already owned by another DOM tree', () => {
    const host = document.createElement('div');
    const invalid = createDOMAdapter<string>(() => ({}) as HTMLElement);
    expect(() => invalid.mount(host, 'a', { row: 0, col: 0 })).toThrow(TypeError);
    const element = document.createElement('div');
    document.body.append(element);
    const attached = createDOMAdapter<string>(() => element);
    expect(() => attached.mount(host, 'a', { row: 0, col: 0 })).toThrow();
    expect(element.parentNode).toBe(document.body);
  });
});
