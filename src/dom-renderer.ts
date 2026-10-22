import { CORE_TEXT, CORE_MESSAGES, translateOffset } from './config';
import { DIRECTIONS, ZERO_OFFSET as ZERO, EASING_POWER } from './config';
import type { Direction, Position } from './navigation';
import type { GestureOffset, GestureSettlement } from './gesture';
import { isHTMLElement } from './dom-element';
/**
 * Isolated operations for an adapter-owned subtree inside one host.
 */
export interface MountedCell<T> {
  /** Update a still-mounted item while preserving host and component identity. */
  readonly update: (item: T, position: Position) => void;
  /** Release the owned subtree once; stale handles must remain inactive. */
  readonly unmount: () => void;
}
/**
 * Framework-independent cell ownership contract over renderer-provided hosts.
 */
export interface CellAdapter<T> {
  /** Mount one item into the supplied host and return isolated update and cleanup operations. */
  readonly mount: (host: HTMLElement, item: T, position: Position) => MountedCell<T>;
}
/** Readonly navigation queries used to build a bounded rendering window. */
export interface NavigationSource<T> {
  readonly getPosition: () => Position;
  readonly getNeighbor: (direction: Direction) => Position | null;
  readonly getItem: (position: Position) => T;
}
/** Cached viewport dimensions measured in CSS pixels. */
export interface RendererSize {
  readonly width: number;
  readonly height: number;
}
/** Container ownership, navigation queries, rendering adapter, and optional resize notification. */
export interface DOMRendererOptions<T> {
  readonly container: HTMLElement;
  readonly navigation: NavigationSource<T>;
  readonly adapter: CellAdapter<T>;
  /** Notify after cached geometry is updated and conflicting visual motion has been cancelled. */
  readonly onResize?: (size: RendererSize) => void;
}
type Role = 'current' | Direction;
/** Validated coordinates, item identity, and renderer role for one window cell. */
interface Descriptor<T> {
  readonly key: string;
  readonly role: Role;
  readonly position: Position;
  readonly item: T;
}
/** Owned host, mounted adapter handle, and current renderer role. */
interface Cell<T> {
  readonly host: HTMLElement;
  readonly handle: MountedCell<T>;
  role: Role;
}
/** Cancellable frame interpolation state and its completion resolver. */
interface Animation {
  readonly from: GestureOffset;
  readonly to: GestureOffset;
  readonly duration: number;
  readonly resolve: (completed: boolean) => void;
  start: number | null;
}
/** Original inline styling and the value installed by this renderer. */
interface SavedStyle {
  readonly value: string;
  readonly priority: string;
  readonly applied: string;
}
/**
 * Validate an object-shaped runtime input before reading its fields.
 */
function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(CORE_MESSAGES.object(label));
  }
  const result = value as Record<string, unknown>;

  return result;

}
/**
 * Validate coordinates and return an immutable position snapshot.
 */
function checkedPosition(input: unknown): Position {
  const position = object(input, CORE_TEXT.position);
  const { row, col } = position;
  if (typeof row !== 'number' || typeof col !== 'number') {
    throw new TypeError(CORE_TEXT.positionRequiresNumericRowCol);
  }
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(col) || row < 0 || col < 0) {
    throw new RangeError(CORE_TEXT.positionMustUseNonNegativeSafeIntegers);
  }
  const result = Object.freeze({ row, col });

  return result;

}
/**
 * Snapshot and validate only the current cell and its existing immediate neighbors.
 */
function readWindow<T>(source: NavigationSource<T>): Descriptor<T>[] {
  const current = checkedPosition(source.getPosition());
  const descriptor = (position: Position, role: Role): Descriptor<T> => ({
    key: `${String(position.row)}:${String(position.col)}`,
    position,
    role,
    item: source.getItem(position),
  });
  const result = [descriptor(current, CORE_TEXT.current)];
  for (const direction of DIRECTIONS) {
    const neighbor = source.getNeighbor(direction);
    if (neighbor === null) {
      continue;
    }
    const position = checkedPosition(neighbor);
    const expected = {
      up: { row: current.row + 1, col: 0 },
      down: { row: current.row - 1, col: 0 },
      left: { row: current.row, col: current.col + 1 },
      right: { row: current.row, col: current.col - 1 },
    }[direction];
    if (position.row !== expected.row || position.col !== expected.col) {
      throw new RangeError(CORE_TEXT.navigationSourceReturnedANonAdjacentNeighbor);
    }
    result.push(descriptor(position, direction));
  }

  return result;

}
/**
 * Read container geometry once and return a validated immutable size.
 */
function measure(container: HTMLElement): RendererSize {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 0 ||
    height < 0 ||
    width > Number.MAX_SAFE_INTEGER ||
    height > Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError(CORE_TEXT.invalidContainerGeometry);
  }
  const result = Object.freeze({ width, height });

  return result;

}
/**
 * Validate axis-aligned viewport-relative motion before scheduling a frame.
 */
function checkedOffset(input: unknown, size: RendererSize): GestureOffset {
  const value = object(input, CORE_TEXT.offset);
  if (typeof value.x !== 'number' || typeof value.y !== 'number') {
    throw new TypeError(CORE_TEXT.offsetRequiresNumericXY);
  }
  const { x, y } = value;
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x !== 0 && y !== 0) || Math.abs(x) > size.width || Math.abs(y) > size.height) {
    throw new RangeError(CORE_TEXT.offsetMustBeFiniteAxisAlignedAndWithinOneViewport);
  }
  const result = Object.freeze({ x: x === 0 ? 0 : x, y: y === 0 ? 0 : y });

  return result;

}
/**
 * Calculate the single-viewport target offset for a direction.
 */
function targetOffset(direction: Direction | null, size: RendererSize): GestureOffset {
  const result = Object.freeze({
    x: direction === CORE_TEXT.left ? -size.width : direction === CORE_TEXT.right ? size.width : 0,
    y: direction === CORE_TEXT.up ? -size.height : direction === CORE_TEXT.down ? size.height : 0,
  });

  return result;

}
/**
 * Validate a settlement plan before interrupting an existing animation.
 */
function checkedPlan(input: unknown, size: RendererSize): GestureSettlement {
  const plan = object(input, CORE_TEXT.animationPlan);
  if (plan.direction !== null && !DIRECTIONS.includes(plan.direction as Direction)) {
    throw new TypeError(CORE_TEXT.invalidAnimationDirection);
  }
  if (typeof plan.duration !== 'number') {
    throw new TypeError(CORE_TEXT.animationDurationMustBeNumeric);
  }
  if (!Number.isFinite(plan.duration) || plan.duration < 0) {
    throw new RangeError(CORE_TEXT.animationDurationMustBeFiniteAndNonNegative);
  }
  const direction = plan.direction as Direction | null;
  const from = checkedOffset(plan.from, size);
  const to = checkedOffset(plan.to, size);
  const expected = targetOffset(direction, size);
  if (to.x !== expected.x || to.y !== expected.y || (from.x !== 0 && to.y !== 0) || (from.y !== 0 && to.x !== 0)) {
    throw new RangeError(CORE_TEXT.animationTargetMustMatchItsDirectionAndViewport);
  }
  const result = Object.freeze({ direction, from, to, duration: plan.duration });

  return result;

}
/**
 * Validate adapter update and unmount operations before accepting host ownership.
 */
function checkedHandle<T>(input: MountedCell<T>): MountedCell<T> {
  const value = object(input, CORE_TEXT.mountedCellHandle);
  if (typeof value.update !== 'function' || typeof value.unmount !== 'function') {
    throw new TypeError(CORE_TEXT.adapterHandleRequiresUpdateAndUnmount);
  }

  return input;

}
/**
 * Functional renderer operations with bounded cell ownership and cancellable animation.
 */
export interface DOMRenderer {
  /** Read cached viewport dimensions without triggering layout. */
  readonly getSize: () => RendererSize;
  /** Schedule an axis-aligned offset update without reading layout. */
  readonly setOffset: (offset: GestureOffset) => boolean;
  /** Animate one settlement plan and resolve every completion or cancellation. */
  readonly animate: (plan: GestureSettlement) => Promise<boolean>;
  /** Reconcile the bounded rendering window with the current navigation snapshot. */
  readonly sync: () => void;
  /** Cancel pending motion and restore the viewport origin. */
  readonly reset: () => void;
  /** Release owned resources once and settle pending work without leaving stale callbacks. */
  readonly destroy: () => void;
}
/**
 * Create a bounded DOM rendering window with cancellable RAF animation and resource ownership.
 * @param options Validated container, grid, rendering strategy, and optional lifecycle callbacks.
 * @returns Independent operations that can be called without binding a receiver.
 */
export function createDOMRenderer<T>(options: DOMRendererOptions<T>): DOMRenderer {
  let stateContainer: HTMLElement | null = null;
  let stateView: (Window & typeof globalThis) | null = null;
  let stateRoot: HTMLElement | null = null;
  let stateSource: NavigationSource<T> | null = null;
  let stateAdapter: CellAdapter<T> | null = null;
  let stateObserver: ResizeObserver | null = null;
  let stateOnResize: ((size: RendererSize) => void) | undefined;
  let stateSize: RendererSize = Object.freeze({ width: 0, height: 0 });
  let stateOffset: GestureOffset = ZERO;
  const stateCells = new Map<string, Cell<T>>();
  const stateStyles = new Map<string, SavedStyle>();
  let stateFrameId: number | null = null;
  let stateEpoch = 0;
  let stateResizePending = false;
  let stateAnimation: Animation | null = null;
  let stateDestroyed = false;
  let stateSyncing = false;
  /**
   * Read cached viewport dimensions without triggering layout.
   */
  function getSize(): RendererSize {

    return stateSize;

  }
  /**
   * Schedule an axis-aligned offset update without reading layout.
   */
  function setOffset(offset: GestureOffset): boolean {
    if (!readAcceptsMotion()) {
      const result = false;

      return result;

    }
    const next = checkedOffset(offset, stateSize);
    stateOffset = next;
    schedule();
    const result = true;

    return result;

  }
  /**
   * Animate one settlement plan and resolve every completion or cancellation.
   */
  function animate(plan: GestureSettlement): Promise<boolean> {
    if (!readAcceptsMotion()) {
      const result = Promise.resolve(false);

      return result;

    }
    let checked: GestureSettlement;
    try {
      checked = checkedPlan(plan, stateSize);
    } catch (error) {
      const result = Promise.reject(error instanceof Error ? error : new Error(CORE_TEXT.animationValidationFailed, { cause: error }));

      return result;

    }
    if (checked.direction !== null && ![...stateCells.values()].some((cell) => cell.role === checked.direction)) {
      const result = Promise.resolve(false);

      return result;

    }
    stateOffset = checked.from;
    const result = new Promise<boolean>((resolve) => {
      stateAnimation = { from: checked.from, to: checked.to, duration: checked.duration, start: null, resolve };
      schedule();
    });

    return result;

  }
  /**
   * Reconcile the bounded rendering window with the current navigation snapshot.
   */
  function sync(): void {
    if (stateDestroyed || stateSource === null)
      return;

    if (stateSyncing) {
      throw new Error(CORE_TEXT.cannotSyncDuringAdapterLifecycle);
    }
    // Read and validate the complete source before interrupting a valid animation.
    const descriptors = readWindow(stateSource);
    cancelWork();
    stateOffset = ZERO;
    try {
      reconcile(descriptors);
      paint();
      if (stateResizePending) {
        schedule();
      }
    } catch (error) {
      fail(error);
    }
  }
  /**
   * Cancel pending motion and restore the viewport origin.
   */
  function reset(): void {
    if (stateDestroyed)
      return;

    cancelWork();
    stateOffset = ZERO;
    paint();
    if (stateResizePending) {
      schedule();
    }
  }
  /**
   * Release owned resources once and settle pending work without leaving stale callbacks.
   */
  function destroy(): void {
    if (stateDestroyed)
      return;

    stateDestroyed = true;
    cancelWork();
    const errors: unknown[] = [];
    const attempt = (callback: () => void) => {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    };
    const observer = stateObserver;
    stateObserver = null;
    if (observer !== null) {
      attempt(() => {
        observer.disconnect();
      });
    }
    const cells = [...stateCells.values()];
    stateCells.clear();
    for (const cell of cells) {
      attempt(() => {
        cell.handle.unmount();
      });
      attempt(() => {
        cell.host.remove();
      });
    }
    const root = stateRoot;
    stateRoot = null;
    if (root !== null) {
      attempt(() => {
        root.remove();
      });
    }
    const container = stateContainer;
    if (container !== null) {
      for (const [property, saved] of stateStyles) {
        attempt(() => {
          if (
            container.style.getPropertyValue(property) === saved.applied &&
            container.style.getPropertyPriority(property) === CORE_TEXT.empty
          ) {
            if (saved.value === CORE_TEXT.empty) {
              container.style.removeProperty(property);
            } else {
              container.style.setProperty(property, saved.value, saved.priority);
            }
          }
        });
      }
    }
    stateStyles.clear();
    stateSource = null;
    stateAdapter = null;
    stateOnResize = undefined;
    stateContainer = null;
    stateView = null;
    stateOffset = ZERO;
    stateResizePending = false;
    if (errors.length !== 0) {
      throw new AggregateError(errors, CORE_TEXT.rendererCleanupFailed);
    }
  }
  /**
   * Read disposal state across potentially reentrant adapter lifecycle operations.
   */
  function readDestroyed(): boolean {

    return stateDestroyed;

  }
  /** Guard against motion during cleanup, reconciliation, and active animation. */
  function readAcceptsMotion(): boolean {
    const result = !stateDestroyed && !stateSyncing && stateAnimation === null && stateSize.width > 0 && stateSize.height > 0;

    return result;

  }
  /**
   * Apply a local container style while retaining the original value and priority.
   */
  function applyStyle(property: string, applied: string): void {
    const style = stateContainer?.style;
    if (style === undefined)
      return;

    stateStyles.set(property, { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property), applied });
    style.setProperty(property, applied);
  }
  /**
   * Unmount outgoing cells and update or mount only the current bounded neighbor window.
   */
  function reconcile(descriptors: readonly Descriptor<T>[]): void {
    const root = stateRoot;
    const adapter = stateAdapter;
    if (root === null || adapter === null)
      return;

    stateSyncing = true;
    try {
      const wanted = new Set(descriptors.map((descriptor) => descriptor.key));
      for (const [key, cell] of stateCells) {
        if (wanted.has(key)) {
          continue;
        }
        stateCells.delete(key);
        try {
          cell.handle.unmount();
        } finally {
          cell.host.remove();
        }
        if (stateDestroyed)
          return;

      }
      for (const descriptor of descriptors) {
        const existing = stateCells.get(descriptor.key);
        if (existing !== undefined) {
          existing.role = descriptor.role;
          decorate(existing.host, descriptor);
          existing.handle.update(descriptor.item, descriptor.position);
          if (stateDestroyed)
            return;

        } else {
          const host = root.ownerDocument.createElement(CORE_TEXT.div);
          host.style.cssText = CORE_TEXT.positionAbsoluteInset0OverflowHiddenBoxSizingBorderBoxWillChangeTransform;
          decorate(host, descriptor);
          root.append(host);
          const handle = checkedHandle(adapter.mount(host, descriptor.item, descriptor.position));
          if (stateDestroyed) {
            handle.unmount();

            return;

          }
          stateCells.set(descriptor.key, { host, handle, role: descriptor.role });
        }
      }
    } finally {
      stateSyncing = false;
    }
  }
  /**
   * Assign host coordinates, accessibility metadata, and renderer role before adapter updates.
   */
  function decorate(host: HTMLElement, descriptor: Descriptor<T>): void {
    host.dataset.tikitakiCell = descriptor.key;
    host.dataset.tikitakiRole = descriptor.role;
    host.inert = descriptor.role !== CORE_TEXT.current;
    host.setAttribute(CORE_TEXT.ariaHidden, descriptor.role === CORE_TEXT.current ? CORE_TEXT.false : CORE_TEXT.true);
  }
  /**
   * Write cached transforms for the current cell and its valid adjacent hosts without layout reads.
   */
  function paint(): void {
    if (stateRoot === null)
      return;

    const { width, height } = stateSize;
    stateRoot.style.visibility = width === 0 || height === 0 ? CORE_TEXT.hidden : CORE_TEXT.empty;
    for (const cell of stateCells.values()) {
      const x = (cell.role === CORE_TEXT.left ? width : cell.role === CORE_TEXT.right ? -width : 0) + stateOffset.x;
      const y = (cell.role === CORE_TEXT.up ? height : cell.role === CORE_TEXT.down ? -height : 0) + stateOffset.y;
      cell.host.style.transform = translateOffset(x, y);
    }
  }
  /**
   * Coalesce pending geometry and motion work into one owned animation frame.
   */
  function schedule(): void {
    const view = stateView;
    if (stateDestroyed || stateFrameId !== null || view === null)
      return;

    const epoch = stateEpoch;
    stateFrameId = view.requestAnimationFrame((time) => {
      if (stateDestroyed || epoch !== stateEpoch)
        return;

      stateFrameId = null;
      try {
        frame(time);
      } catch (error) {
        fail(error);
      }
    });
  }
  /**
   * Measure pending resize once, interpolate settlement progress, and paint the next frame.
   */
  function frame(time: number): void {
    if (stateResizePending && stateContainer !== null) {
      stateResizePending = false;
      const size = measure(stateContainer);
      if (size.width !== stateSize.width || size.height !== stateSize.height) {
        cancelWork();
        stateSize = size;
        stateOffset = ZERO;
        paint();
        stateOnResize?.(size);

        return;

      }
    }
    const animation = stateAnimation;
    if (animation !== null) {
      animation.start ??= time;
      const progress = animation.duration === 0 ? 1 : Math.min(1, Math.max(0, (time - animation.start) / animation.duration));
      const eased = 1 - (1 - progress) ** EASING_POWER;
      stateOffset = Object.freeze({
        x: animation.from.x + (animation.to.x - animation.from.x) * eased,
        y: animation.from.y + (animation.to.y - animation.from.y) * eased,
      });
      paint();
      if (progress === 1) {
        stateAnimation = null;
        animation.resolve(true);
      } else {
        schedule();
      }
    } else {
      paint();
    }
  }
  /**
   * Invalidate scheduled callbacks and settle any pending animation as cancelled.
   */
  function cancelWork(): void {
    stateEpoch += 1;
    if (stateFrameId !== null) {
      stateView?.cancelAnimationFrame(stateFrameId);
    }
    stateFrameId = null;
    const animation = stateAnimation;
    stateAnimation = null;
    animation?.resolve(false);
  }
  /**
   * Destroy the rendering window and rethrow the original operation failure with cleanup errors.
   */
  function fail(error: unknown): never {
    try {
      destroy();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], CORE_TEXT.rendererOperationAndCleanupFailed, { cause: cleanupError });
    }
    throw error;
  }
  const input = object(options, CORE_TEXT.rendererOptions);
  if (!isHTMLElement(input.container)) {
    throw new TypeError(CORE_TEXT.rendererContainerMustBeAnHTMLElement);
  }
  const { container } = options;
  const source = object(input.navigation, CORE_TEXT.navigationSource);
  if (typeof source.getPosition !== 'function' || typeof source.getNeighbor !== 'function' || typeof source.getItem !== 'function') {
    throw new TypeError(CORE_TEXT.invalidNavigationSource);
  }
  const adapter = object(input.adapter, CORE_TEXT.cellAdapter);
  if (typeof adapter.mount !== 'function') {
    throw new TypeError(CORE_TEXT.adapterRequiresMount);
  }
  if (options.onResize !== undefined && typeof options.onResize !== 'function') {
    throw new TypeError(CORE_TEXT.onResizeMustBeAFunction);
  }
  if ([...container.children].some((child) => child.hasAttribute(CORE_TEXT.dataTikitakiViewport))) {
    throw new Error(CORE_TEXT.containerAlreadyHasARenderer);
  }
  const view = container.ownerDocument.defaultView;
  if (view === null || typeof view.ResizeObserver !== 'function') {
    throw new Error(CORE_TEXT.dOMRendererRequiresResizeObserverAndAnActiveDocument);
  }
  const descriptors = readWindow(options.navigation);
  const size = measure(container);
  const position = view.getComputedStyle(container).position;
  stateContainer = container;
  stateView = view;
  stateSource = options.navigation;
  stateAdapter = options.adapter;
  stateSize = size;
  stateOnResize = options.onResize;
  try {
    const observer = new view.ResizeObserver(() => {
      if (stateDestroyed)
        return;

      stateResizePending = true;
      schedule();
    });
    stateObserver = observer;
    if (position === CORE_TEXT.static || position === CORE_TEXT.empty) {
      applyStyle(CORE_TEXT.positionStyle, CORE_TEXT.relative);
    }
    applyStyle(CORE_TEXT.overflow, CORE_TEXT.hidden);
    applyStyle(CORE_TEXT.touchAction, CORE_TEXT.none);
    const root = container.ownerDocument.createElement(CORE_TEXT.div);
    root.dataset.tikitakiViewport = CORE_TEXT.empty;
    root.style.cssText = CORE_TEXT.positionAbsoluteInset0OverflowHiddenIsolationIsolate;
    stateRoot = root;
    container.append(root);
    reconcile(descriptors);
    paint();
    if (!readDestroyed()) {
      observer.observe(container);
    }
  } catch (error) {
    fail(error);
  }
  const api: DOMRenderer = { getSize, setOffset, animate, sync, reset, destroy };

  return api;

}
