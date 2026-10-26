import { createResizeObserverMock } from './helpers/resize-observer';
// @vitest-environment jsdom
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSwipeEngine, type SwipeEngine } from '../src/dom';
import type { SwipeEngineOptions } from '../src/dom';
import type { CellAdapter } from '../src/dom';
import type { Direction, Grid, Position } from '../src/index';
const Observer = createResizeObserverMock();
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let engines: SwipeEngine<string>[];
/**
 * frame
 * @param time The time argument.
 */
function frame(time = 0) {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(time);
}
/**
 * finish
 * @returns A promise that resolves when the operation completes.
 */
async function finish() {
  frame(0);
  frame(300);
  await Promise.resolve();
  await Promise.resolve();
}
const grid: Grid<string> = [['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'], ['B1'], ['C1', 'C2', 'C3'], ['D1', 'D2']];
/**
 * viewport
 * @param width The width argument.
 * @param height The height argument.
 * @returns The callback or factory created by this function.
 */
function viewport(width = 300, height = 600) {
  const container = document.createElement('div');
  const size = { width, height };
  Object.defineProperties(container, {
    clientWidth: {
      /**
       * get
       * @returns The computed numeric value.
       */
      get: () => size.width,
    },
    clientHeight: {
      /**
       * get
       * @returns The computed numeric value.
       */
      get: () => size.height,
    },
  });
  const captured = new Set<number>();
  const capture = vi.fn((id: number) => {
    captured.add(id);
  });
  const release = vi.fn((id: number) => {
    captured.delete(id);
  });
  Object.assign(container, {
    setPointerCapture: capture,
    releasePointerCapture: release,
    /**
     * hasPointerCapture
     * @param id The id argument.
     * @returns Whether the operation succeeded or the condition holds.
     */
    hasPointerCapture: (id: number) => captured.has(id),
  });
  document.body.append(container);
  const result = { container, size, captured, capture, release };

  return result;
}
/**
 * setup
 * @param extra The extra argument.
 * @param width The width argument.
 * @param height The height argument.
 * @returns The callback or factory created by this function.
 */
function setup(extra: Partial<SwipeEngineOptions<string>> = {}, width = 300, height = 600) {
  const view = viewport(width, height);
  const changes = vi.fn<(position: Position, previous: Position) => void>();
  const errors = vi.fn<(error: Error) => void>();
  const render = vi.fn((item: string) => {
    const button = document.createElement('button');
    button.textContent = item;

    return button;
  });
  const engine = createSwipeEngine<string>({
    container: view.container,
    grid,
    initialPosition: { row: 0, col: 9 },
    renderCell: render,
    onPositionChange: changes,
    onError: errors,
    ...extra,
  } as SwipeEngineOptions<string>);
  engines.push(engine);
  const result = { ...view, engine, changes, errors, render };

  return result;
}
/**
 * current
 * @param container The dedicated engine container.
 * @returns The rendered HTML element.
 */
function current(container: HTMLElement) {
  const element = container.querySelector<HTMLElement>('[data-tikitaki-role="current"]');
  assert(element !== null);

  return element;
}
/**
 * pointer
 * @param target The requested target.
 * @param type The type argument.
 * @param x The x argument.
 * @param y The y argument.
 * @param time The time argument.
 * @param overrides The overrides argument.
 * @returns The dispatched pointer event.
 */
function pointer(
  target: EventTarget,
  type: string,
  x = 0,
  y = 0,
  time = 0,
  overrides: { pointerId?: number; pointerType?: string; isPrimary?: boolean; button?: number } = {},
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: overrides.button ?? 0 });
  Object.defineProperties(event, {
    pointerId: { value: overrides.pointerId ?? 1 },
    pointerType: { value: overrides.pointerType ?? 'mouse' },
    isPrimary: { value: overrides.isPrimary ?? true },
    timeStamp: { value: time },
  });
  target.dispatchEvent(event);

  return event;
}
beforeEach(() => {
  frames = new Map();
  frameId = 0;
  engines = [];
  Observer.instances = [];
  vi.stubGlobal('ResizeObserver', Observer.construct);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frameId += 1;
    frames.set(frameId, callback);

    return frameId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
});
afterEach(() => {
  for (const engine of engines) engine.destroy();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
describe('public navigation', () => {
  it('constructs with renderCell, owns readonly position, and does not notify initially', () => {
    const { engine, container, changes, render } = setup();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    expect(Object.isFrozen(engine.getPosition())).toBe(true);
    expect(current(container).textContent).toBe('A10');
    expect(changes).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(3);
  });
  it('commits only after animation and a consistent DOM, then invokes the callback', async () => {
    const { engine, container, changes } = setup();
    changes.mockImplementation((position, previous) => {
      expect(position).toEqual(engine.getPosition());
      expect(current(container).textContent).toBe('B1');
      expect(current(container).style.transform).toBe('translate3d(0px, 0px, 0px)');
      expect(previous).toEqual({ row: 0, col: 9 });
    });
    const result = engine.navigate('up');
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    frame(0);
    frame(150);
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    frame(300);
    await expect(result).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(changes).toHaveBeenCalledOnce();
  });
  const directions: [Direction, Position][] = [
    ['up', { row: 3, col: 0 }],
    ['down', { row: 1, col: 0 }],
    ['left', { row: 2, col: 2 }],
    ['right', { row: 2, col: 0 }],
  ];
  it.each(directions)('navigates %s by one neighbor', async (direction, target) => {
    const { engine } = setup({ initialPosition: { row: 2, col: 1 } });
    const result = engine.navigate(direction);
    await finish();
    await expect(result).resolves.toBe(true);
    expect(engine.getPosition()).toEqual(target);
  });
  it('keeps the column at vertical boundaries and does not allocate a frame', async () => {
    const { engine, changes } = setup();
    await expect(engine.navigate('down')).resolves.toBe(false);
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    expect(frames.size).toBe(0);
    expect(changes).not.toHaveBeenCalled();
    await engine.goTo({ row: 3, col: 1 });
    changes.mockClear();
    await expect(engine.navigate('up')).resolves.toBe(false);
    expect(engine.getPosition()).toEqual({ row: 3, col: 1 });
    expect(changes).not.toHaveBeenCalled();
  });
  it('returns false while settling and does not queue commands', async () => {
    const { engine } = setup();
    const first = engine.navigate('up');
    await expect(engine.navigate('up')).resolves.toBe(false);
    await expect(engine.goTo({ row: 2, col: 2 })).resolves.toBe(false);
    await finish();
    await expect(first).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(frames.size).toBe(0);
  });
  it('goTo jumps immediately without intermediate mounts or animation', async () => {
    const { engine, container, changes, render } = setup();
    render.mockClear();
    await expect(engine.goTo({ row: 2, col: 2 })).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 2, col: 2 });
    expect(current(container).textContent).toBe('C3');
    expect(frames.size).toBe(0);
    // C2 is mounted as a neighbor; no traversal through C1/A1 occurs.
    expect(render.mock.calls.map(([item]) => item)).not.toContain('C1');
    expect(render.mock.calls.map(([item]) => item)).not.toContain('A1');
    expect(changes).toHaveBeenCalledOnce();
    await expect(engine.goTo({ row: 2, col: 2 })).resolves.toBe(false);
    expect(changes).toHaveBeenCalledOnce();
  });
  it('rejects invalid commands before disturbing an active transition', async () => {
    const { engine } = setup();
    const first = engine.navigate('up');
    await expect(engine.navigate('diagonal' as Direction)).rejects.toThrow(TypeError);
    await expect(engine.goTo({ row: 1, col: 1 })).rejects.toThrow(RangeError);
    await expect(engine.goTo(null as unknown as Position)).rejects.toThrow(TypeError);
    await finish();
    await expect(first).resolves.toBe(true);
  });
  it('handles duration zero and still waits for its RAF before commit', async () => {
    const { engine } = setup({ gesture: { animationDuration: 0 } });
    const result = engine.navigate('up');
    expect(engine.getPosition().row).toBe(0);
    frame();
    await expect(result).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(frames.size).toBe(0);
  });
  it('callback exceptions reject after commit and leave the engine usable', async () => {
    const { engine, changes } = setup();
    changes.mockImplementationOnce(() => {
      throw new Error('callback failure');
    });
    const result = engine.navigate('up');
    const rejected = expect(result).rejects.toThrow('callback failure');
    await finish();
    await rejected;
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    const next = engine.navigate('down');
    await finish();
    await expect(next).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 0, col: 0 });
  });
  it('callbacks may start the next transition without a stale finally cancelling it', async () => {
    const { engine, changes } = setup();
    let second: Promise<boolean> | undefined;
    changes.mockImplementationOnce(() => {
      second = engine.navigate('up');
    });
    const first = engine.navigate('up');
    await finish();
    await expect(first).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    await finish();
    await expect(second).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 2, col: 0 });
  });
  it('destroy from a notification keeps the completed transition result true', async () => {
    const { engine, changes, container } = setup();
    changes.mockImplementationOnce(() => {
      engine.destroy();
    });
    const result = engine.navigate('up');
    await finish();
    await expect(result).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(container.children).toHaveLength(0);
  });
});
describe('pointer events and capture', () => {
  it.each(['pointermove', 'pointerup'])('drops capture from a detached target on a global %s', async (type) => {
    const { engine, container, capture, release, captured, changes } = setup();
    const button = current(container).querySelector('button');
    assert(button !== null);
    Object.assign(button, {
      setPointerCapture: capture,
      releasePointerCapture: release,
      /**
       * hasPointerCapture
       * @param id The id argument.
       * @returns Whether the operation succeeded or the condition holds.
       */
      hasPointerCapture: (id: number) => captured.has(id),
    });
    pointer(button, 'pointerdown', 0, 0, 0);
    button.remove();
    pointer(window, type, 0, -120, 1000);
    pointer(container, 'pointerup', 0, -120, 1100);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    expect(captured.size).toBe(0);
    expect(changes).not.toHaveBeenCalled();
    const next = engine.navigate('up');
    await finish();
    await expect(next).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
  });
  it.each(['mouse', 'touch', 'pen'])('supports %s input, follows the pointer, and commits once', async (pointerType) => {
    const { engine, container, capture, release, changes } = setup();
    pointer(container, 'pointerdown', 50, 300, 0, { pointerType });
    expect(capture).toHaveBeenCalledWith(1);
    pointer(container, 'pointermove', 50, 180, 1000, { pointerType });
    frame();
    expect(current(container).style.transform).toBe('translate3d(0px, -120px, 0px)');
    pointer(container, 'pointerup', 50, 180, 1100, { pointerType });
    expect(release).toHaveBeenCalledWith(1);
    pointer(container, 'lostpointercapture', 0, 0, 1110, { pointerType });
    pointer(container, 'pointerup', 50, 0, 1120, { pointerType });
    pointer(container, 'pointerdown', 50, 300, 1200, { pointerType });
    await finish();
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(changes).toHaveBeenCalledOnce();
  });
  it.each(['pointercancel', 'lostpointercapture'])('%s rolls back and releases capture without notifying', async (type) => {
    const { engine, container, changes, captured } = setup();
    pointer(container, 'pointerdown');
    pointer(container, 'pointermove', 0, -120, 1000);
    frame();
    pointer(container, type, 0, -120, 1010);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    expect(current(container).style.transform).toBe('translate3d(0px, 0px, 0px)');
    expect(changes).not.toHaveBeenCalled();
    expect(captured.size).toBe(0);
  });
  it('ignores unrelated pointers, non-primary input, and non-left mouse buttons', async () => {
    const { engine, container, capture } = setup();
    pointer(container, 'pointerdown', 0, 0, 0, { button: 2 });
    pointer(container, 'pointerdown', 0, 0, 0, { isPrimary: false });
    expect(capture).not.toHaveBeenCalled();
    pointer(container, 'pointerdown');
    pointer(container, 'pointerdown', 100, 100, 1, { pointerId: 2 });
    pointer(container, 'pointermove', 0, -500, 10, { pointerId: 2 });
    pointer(container, 'pointerup', 0, -500, 20, { pointerId: 2 });
    expect(capture).toHaveBeenCalledTimes(1);
    await expect(engine.navigate('up')).resolves.toBe(false);
    pointer(container, 'pointerup', 0, -120, 1000);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
  });
  it('ignores programmatic navigation during tracking and dragging', async () => {
    const { engine, container } = setup();
    pointer(container, 'pointerdown');
    await expect(engine.goTo({ row: 2, col: 2 })).resolves.toBe(false);
    pointer(container, 'pointermove', 0, -50, 1000);
    await expect(engine.navigate('up')).resolves.toBe(false);
    pointer(container, 'pointercancel');
    await finish();
    await expect(engine.goTo({ row: 2, col: 2 })).resolves.toBe(true);
  });
  it('handles a tap immediately and suppresses only the mouse click after a drag', async () => {
    const { container, changes } = setup();
    const clicked = vi.fn();
    container.addEventListener('click', clicked);
    pointer(container, 'pointerdown');
    pointer(container, 'pointerup', 1, 1, 100);
    container.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(clicked).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
    pointer(container, 'pointerdown');
    pointer(container, 'pointermove', 0, -30, 1000);
    pointer(container, 'pointerup', 0, -30, 1100);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    container.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(clicked).toHaveBeenCalledOnce();
    await finish();
    container.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(clicked).toHaveBeenCalledTimes(2);
    expect(changes).not.toHaveBeenCalled();
  });
  it('prevents native HTML drag/selection only while a gesture is active', () => {
    const { container } = setup();
    const idleDrag = new Event('dragstart', { bubbles: true, cancelable: true });
    container.dispatchEvent(idleDrag);
    expect(idleDrag.defaultPrevented).toBe(false);
    pointer(container, 'pointerdown');
    for (const type of ['dragstart', 'selectstart']) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      container.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
  it('gracefully drops a pointer that disappears before capture', async () => {
    const { engine, container, capture, errors } = setup();
    capture.mockImplementationOnce(() => {
      throw new DOMException('Pointer disappeared', 'NotFoundError');
    });
    pointer(container, 'pointerdown');
    pointer(container, 'pointerup', 0, -120, 1000);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    expect(errors).not.toHaveBeenCalled();
    pointer(container, 'pointerdown');
    pointer(container, 'pointerup', 0, -120, 1000);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
  });
  it('routes asynchronous pointer callback errors to onError without unhandled rejection', async () => {
    const { engine, container, changes, errors } = setup();
    changes.mockImplementationOnce(() => {
      throw new Error('pointer notification failed');
    });
    pointer(container, 'pointerdown');
    pointer(container, 'pointerup', 0, -120, 1000);
    await finish();
    expect(errors).toHaveBeenCalledOnce();
    expect(errors.mock.calls[0]?.[0].message).toBe('pointer notification failed');
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    const next = engine.navigate('down');
    await finish();
    await expect(next).resolves.toBe(true);
  });
});
describe('grid, resize, and cleanup', () => {
  it('valid updateGrid cancels a transition, clamps position, updates DOM and notifies once', async () => {
    const { engine, container, changes } = setup();
    const result = engine.navigate('up');
    frame();
    engine.updateGrid([['only']]);
    await expect(result).resolves.toBe(false);
    expect(engine.getPosition()).toEqual({ row: 0, col: 0 });
    expect(current(container).textContent).toBe('only');
    expect(frames.size).toBe(0);
    expect(changes).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 9 });
  });
  it('replaces content without emitting a position change when coordinates remain valid', () => {
    const { engine, container, changes } = setup({ initialPosition: { row: 0, col: 0 } });
    engine.updateGrid([['replacement'], ['next']]);
    expect(current(container).textContent).toBe('replacement');
    expect(changes).not.toHaveBeenCalled();
  });
  it('invalid grid replacement preserves the active animation and its Promise', async () => {
    const { engine, container } = setup();
    const result = engine.navigate('up');
    expect(() => {
      engine.updateGrid([[]]);
    }).toThrow(RangeError);
    await finish();
    await expect(result).resolves.toBe(true);
    expect(current(container).textContent).toBe('B1');
  });
  it.each(['tracking', 'dragging'] as const)('updateGrid during %s clears capture and stale pointer events', async (state) => {
    const { engine, container, captured } = setup();
    pointer(container, 'pointerdown');
    if (state === 'dragging') {
      pointer(container, 'pointermove', 0, -50, 1000);
    }
    engine.updateGrid([['new'], ['next']]);
    pointer(container, 'pointerup', 0, -120, 2000);
    await finish();
    expect(captured.size).toBe(0);
    expect(engine.getPosition()).toEqual({ row: 0, col: 0 });
    expect(current(container).textContent).toBe('new');
  });
  it('resize cancels a transition and a stale completion cannot cancel a new one', async () => {
    const { engine, size, changes } = setup();
    const old = engine.navigate('up');
    frame();
    const stale = [...frames.values()];
    size.height = 800;
    Observer.instances[0]?.notify();
    frame(100);
    await expect(old).resolves.toBe(false);
    expect(changes).not.toHaveBeenCalled();
    const next = engine.navigate('up');
    for (const callback of stale) callback(1000);
    await finish();
    await expect(next).resolves.toBe(true);
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(changes).toHaveBeenCalledOnce();
  });
  it('suspends gestures/navigation while hidden and resumes on positive resize', async () => {
    const { engine, container, size, capture } = setup({}, 0, 0);
    pointer(container, 'pointerdown');
    expect(capture).not.toHaveBeenCalled();
    await expect(engine.navigate('up')).resolves.toBe(false);
    await expect(engine.goTo({ row: 2, col: 2 })).resolves.toBe(true);
    size.width = 300;
    size.height = 600;
    Observer.instances[0]?.notify();
    frame();
    const result = engine.navigate('down');
    await finish();
    await expect(result).resolves.toBe(true);
    size.width = 0;
    size.height = 0;
    Observer.instances[0]?.notify();
    frame();
    await expect(engine.navigate('up')).resolves.toBe(false);
    expect(container.querySelector('[data-tikitaki-viewport]')).not.toBeNull();
  });
  it('resize during a captured drag releases it and rejects old pointerup', async () => {
    const { engine, container, size, captured } = setup();
    pointer(container, 'pointerdown');
    pointer(container, 'pointermove', 0, -50, 1000);
    frame();
    size.width = 400;
    Observer.instances[0]?.notify();
    frame();
    expect(captured.size).toBe(0);
    pointer(container, 'pointerup', 0, -200, 1100);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
  });
  it('destroy cancels promises, removes local/global listeners, and preserves last position', async () => {
    const { engine, container, changes } = setup();
    const remove = vi.spyOn(container, 'removeEventListener');
    const removeGlobal = vi.spyOn(window, 'removeEventListener');
    const result = engine.navigate('up');
    engine.destroy();
    engine.destroy();
    await expect(result).resolves.toBe(false);
    expect(remove).toHaveBeenCalled();
    expect(removeGlobal).toHaveBeenCalledWith('lostpointercapture', expect.any(Function), true);
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    expect(container.children).toHaveLength(0);
    expect(container.style.cssText).toBe('');
    expect(container.hasAttribute('data-tikitaki-engine')).toBe(false);
    expect(Observer.instances[0]?.disconnect).toHaveBeenCalledOnce();
    pointer(container, 'pointerdown');
    pointer(container, 'pointerup', 0, -120, 1000);
    await finish();
    expect(changes).not.toHaveBeenCalled();
    await expect(engine.navigate('invalid' as Direction)).resolves.toBe(false);
    await expect(engine.goTo({ row: -1, col: 0 })).resolves.toBe(false);
    engine.updateGrid([[]]);
    expect(frames.size).toBe(0);
  });
  it('destroy releases an active capture and permits a fresh instance on the same container', async () => {
    const { engine, container, captured } = setup();
    pointer(container, 'pointerdown');
    engine.destroy();
    expect(captured.size).toBe(0);
    const fresh = createSwipeEngine({
      container,
      grid: [['fresh']],
      /**
       * renderCell
       * @param item The cell data to render.
       * @returns The rendered cell content.
       */
      renderCell: (item) => {
        const node = document.createElement('div');
        node.textContent = item;

        return node;
      },
    });
    engines.push(fresh);
    expect(current(container).textContent).toBe('fresh');
    await expect(fresh.navigate('left')).resolves.toBe(false);
  });
  it('keeps multiple and nested instances independent', async () => {
    const first = setup();
    const second = setup();
    const nestedView = viewport();
    current(first.container).append(nestedView.container);
    const nested = createSwipeEngine({
      container: nestedView.container,
      grid: [['inner'], ['inner-next']],
      /**
       * renderCell
       * @param item The cell data to render.
       * @returns The rendered cell content.
       */
      renderCell: (item) => {
        const node = document.createElement('div');
        node.textContent = item;

        return node;
      },
    });
    engines.push(nested);
    pointer(nestedView.container, 'pointerdown');
    pointer(nestedView.container, 'pointerup', 0, -120, 1000);
    expect(first.capture).not.toHaveBeenCalled();
    await finish();
    expect(nested.getPosition()).toEqual({ row: 1, col: 0 });
    expect(first.engine.getPosition()).toEqual({ row: 0, col: 9 });
    const next = second.engine.navigate('up');
    first.engine.destroy();
    await finish();
    await expect(next).resolves.toBe(true);
  });
  it('uses adapter lifecycle and still settles pending work if unmount throws', async () => {
    const view = viewport();
    const unmount = vi.fn(() => {
      throw new Error('unmount failure');
    });
    const adapter: CellAdapter<string> = {
      /**
       * mount
       * @param host The engine owned cell host.
       * @param item The cell data to render.
       * @returns The callback or factory created by this function.
       */
      mount(host, item) {
        host.textContent = item;
        const result = { update: vi.fn(), unmount };

        return result;
      },
    };
    const engine = createSwipeEngine({ container: view.container, grid: [['A'], ['B']], adapter });
    engines.push(engine);
    const result = engine.navigate('up');
    expect(() => {
      engine.destroy();
    }).toThrow(AggregateError);
    await expect(result).resolves.toBe(false);
    expect(unmount).toHaveBeenCalledTimes(2);
    expect(view.container.children).toHaveLength(0);
    expect(view.container.style.cssText).toBe('');
  });
  it('adapter commit failure rejects and destroys the engine without a pending promise', async () => {
    const view = viewport();
    const unmount = vi.fn();
    const adapter: CellAdapter<string> = {
      /**
       * mount
       * @param host The engine owned cell host.
       * @param item The cell data to render.
       * @returns The mounted cell update and cleanup operations.
       */
      mount(host, item) {
        host.textContent = item;
        const result = {
          /**
           * update
           */
          update() {
            throw new Error('adapter update failed');
          },
          unmount,
        };

        return result;
      },
    };
    const engine = createSwipeEngine({ container: view.container, grid: [['A'], ['B']], adapter });
    engines.push(engine);
    const result = engine.navigate('up');
    const rejected = expect(result).rejects.toThrow('adapter update failed');
    await finish();
    await rejected;
    expect(view.container.children).toHaveLength(0);
    expect(unmount).toHaveBeenCalledTimes(2);
    expect(engine.getPosition()).toEqual({ row: 0, col: 0 });
    await expect(engine.navigate('up')).resolves.toBe(false);
  });
  it('cleans up partial initialization when attaching listeners fails', () => {
    const view = viewport();
    vi.spyOn(view.container, 'addEventListener').mockImplementationOnce(() => {
      throw new Error('subscription failed');
    });
    expect(() =>
      createSwipeEngine({
        container: view.container,
        grid: [['A']],
        /**
         * renderCell
         * @returns The rendered cell content.
         */
        renderCell: () => document.createElement('div'),
      }),
    ).toThrow('subscription failed');
    expect(view.container.children).toHaveLength(0);
    expect(view.container.style.cssText).toBe('');
    expect(Observer.instances[0]?.disconnect).toHaveBeenCalledOnce();
  });
  it.each([
    [{ gesture: { distanceThreshold: 0 } }, RangeError],
    [{ onPositionChange: 4 }, TypeError],
    [{ onError: 'invalid' }, TypeError],
    [{ adapter: {} }, TypeError],
  ] as const)('rejects invalid options %j without mounting', (extra, ErrorType) => {
    const view = viewport();
    expect(() =>
      createSwipeEngine({
        container: view.container,
        grid: [['A']],
        /**
         * renderCell
         * @returns The rendered cell content.
         */
        renderCell: () => document.createElement('div'),
        ...extra,
      } as unknown as SwipeEngineOptions<string>),
    ).toThrow(ErrorType);
    expect(view.container.children).toHaveLength(0);
    expect(view.container.style.cssText).toBe('');
  });
  it('rejects simultaneous renderCell and adapter rather than silently choosing one', () => {
    const view = viewport();
    const mount = vi.fn<CellAdapter<string>['mount']>();
    const adapter: CellAdapter<string> = { mount };
    expect(() =>
      createSwipeEngine({
        container: view.container,
        grid: [['A']],
        adapter,
        /**
         * renderCell
         * @returns The rendered cell content.
         */
        renderCell: () => document.createElement('div'),
      } as unknown as SwipeEngineOptions<string>),
    ).toThrow(TypeError);
    expect(mount).not.toHaveBeenCalled();
  });
});

describe('wheel navigation', () => {
  /**
   * wheel
   * @param target The requested target.
   * @param deltaY The delta y argument.
   * @param time The time argument.
   * @param options Configuration for this operation.
   * @returns The dispatched wheel event.
   */
  function wheel(target: EventTarget, deltaY: number, time: number, options: WheelEventInit = {}) {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, ...options });
    Object.defineProperty(event, 'timeStamp', { value: time });
    target.dispatchEvent(event);
    return event;
  }
  it('animates down and back up, resetting the column only after successful transitions', async () => {
    const { container, engine } = setup();
    expect(wheel(current(container), -100, 0).defaultPrevented).toBe(true);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    expect(wheel(current(container), 100, 200).defaultPrevented).toBe(true);
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    await finish();
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    wheel(current(container), -1, 500, { deltaMode: WheelEvent.DOM_DELTA_LINE });
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 0 });
  });
  it('preserves the last-row column at the boundary and resets it when moving up', async () => {
    const { container, engine } = setup({ initialPosition: { row: 3, col: 1 } });
    wheel(current(container), 100, 0);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 3, col: 1 });
    wheel(current(container), -100, 200);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 2, col: 0 });
  });
  it('consumes a continuous wheel burst once even when inertia outlasts the animation', async () => {
    const { container, engine, changes } = setup();
    wheel(current(container), 100, 0);
    wheel(current(container), 100, 100);
    await finish();
    wheel(current(container), 50, 200);
    wheel(current(container), 10, 300);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(changes).toHaveBeenCalledTimes(1);
    wheel(current(container), 100, 600);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 2, col: 0 });
  });
  it('preserves browser zoom, horizontal scrolling, cancelled events, and scrolling outside cells', async () => {
    const { container, engine } = setup();
    const cell = current(container);
    expect(wheel(cell, 100, 0, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wheel(cell, 100, 200, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(wheel(cell, 5, 400, { deltaX: 100 }).defaultPrevented).toBe(false);
    expect(wheel(cell, 0, 600).defaultPrevented).toBe(false);
    expect(wheel(container, 100, 800).defaultPrevented).toBe(false);
    cell.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
      },
      { once: true },
    );
    wheel(cell, 100, 1000);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
  });
  it('blocks conflicts during pointer tracking and removes the listener on destroy', async () => {
    const { container, engine } = setup();
    pointer(current(container), 'pointerdown', 150, 300, 0);
    wheel(current(container), 100, 0);
    await finish();
    expect(engine.getPosition()).toEqual({ row: 0, col: 9 });
    engine.destroy();
    expect(wheel(container, 100, 500).defaultPrevented).toBe(false);
    expect(frames.size).toBe(0);
  });
  it('routes wheel input only to the nearest independent engine', async () => {
    const outer = setup();
    const inner = setup();
    current(outer.container).append(inner.container);
    wheel(current(inner.container), 100, 0);
    await finish();
    expect(inner.engine.getPosition()).toEqual({ row: 1, col: 0 });
    expect(outer.engine.getPosition()).toEqual({ row: 0, col: 9 });
  });
});
