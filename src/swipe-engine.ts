import { CORE_TEXT, CORE_MESSAGES, POINTER_TYPES, ORIGIN_POSITION, WHEEL_IDLE_MS } from './config';
import { createNavigationModel, type NavigationModel } from './navigation';
import type { Direction, Grid, Position } from './navigation';
import { createGestureEngine, type GestureEngine } from './gesture';
import type { GestureOptions, GestureContext, GestureSettlement, PointerSample } from './gesture';
import { createDOMRenderer, type DOMRenderer } from './dom-renderer';
import type { CellAdapter } from './dom-renderer';
import { createDOMAdapter } from './dom-adapter';
import { isHTMLElement } from './dom-element';
/** Shared container, grid, gesture tuning, and synchronous callback options. */
interface SwipeEngineBaseOptions<T> {
  readonly container: HTMLElement;
  readonly grid: Grid<T>;
  readonly initialPosition?: Position;
  readonly gesture?: Partial<GestureOptions>;
  /**
   * onPositionChange
   *
   * Notify after the new position and hosts have committed; callback errors do not roll back the position.
   * @param position Zero based cell coordinates.
   * @param previous The previous value or position.
   */
  readonly onPositionChange?: (position: Position, previous: Position) => void;
  /**
   * onError
   *
   * Report event driven failures after owned cleanup; programmatic operations expose their own errors.
   * @param error The failure to report or normalize.
   */
  readonly onError?: (error: Error) => void;
}
export type SwipeEngineOptions<T> = SwipeEngineBaseOptions<T> &
  (
    | {
        /**
         * renderCell
         *
         * Render item content inside the adapter or framework ownership boundary.
         * @param item The cell data to render.
         * @param position Zero based cell coordinates.
         * @returns The rendered HTML element.
         */
        readonly renderCell: (item: T, position: Position) => HTMLElement;
        readonly adapter?: never;
      }
    | { readonly adapter: CellAdapter<T>; readonly renderCell?: never }
  );
/** Identity bearing ownership record for one pending controller transaction. */
interface Transition {
  readonly target: Position | null;
  readonly gesture: GestureSettlement | null;
  /**
   * resolve
   * @param changed Whether the position changed.
   */
  readonly resolve: (changed: boolean) => void;
  /**
   * reject
   * @param error The failure to report or normalize.
   */
  readonly reject: (error: Error) => void;
}
/** An owned DOM subscription and the exact arguments needed to remove it. */
interface Subscription {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListener;
  readonly capture: boolean;
}
/** The original capture element and its active pointer identifier. */
interface Capture {
  readonly element: Element;
  readonly id: number;
}
/**
 * object
 *
 * Validate an object shaped runtime input before reading its fields.
 * @param value The value to process.
 * @param label The label used in validation messages.
 * @returns The validated object with readable fields.
 */
function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(CORE_MESSAGES.object(label));
  }
  const result = value as Record<string, unknown>;

  return result;
}
/**
 * errorFrom
 *
 * Normalize an unknown failure without discarding its original cause.
 * @param value The value to process.
 * @returns The original error or an Error retaining the original cause.
 */
function errorFrom(value: unknown): Error {
  const result = value instanceof Error ? value : new Error(CORE_TEXT.swipeEngineOperationFailed, { cause: value });

  return result;
}
/**
 * isNotFound
 *
 * Recognize pointer capture races reported as NotFoundError.
 * @param value The value to process.
 * @returns Whether the operation succeeded or the condition holds.
 */
function isNotFound(value: unknown): boolean {
  const result = typeof value === 'object' && value !== null && CORE_TEXT.name in value && value.name === CORE_TEXT.notFoundError;

  return result;
}
/**
 * resolveAdapter
 *
 * Require exactly one rendering strategy and resolve the framework independent adapter.
 * @param options Configuration for this operation.
 * @returns The cell adapter with mount, update, and unmount operations.
 */
function resolveAdapter<T>(options: SwipeEngineOptions<T>): CellAdapter<T> {
  const input = object(options, CORE_TEXT.swipeEngineOptions);
  if ((input.adapter === undefined) === (input.renderCell === undefined)) {
    throw new TypeError(CORE_TEXT.provideExactlyOneOfAdapterOrRenderCell);
  }
  if (options.adapter !== undefined) {
    const adapter = object(options.adapter, CORE_TEXT.cellAdapter);
    if (typeof adapter.mount !== 'function') {
      throw new TypeError(CORE_TEXT.adapterRequiresMount);
    }
    const result = options.adapter;

    return result;
  }
  if (typeof input.renderCell !== 'function') {
    throw new TypeError(CORE_TEXT.renderCellMustBeAFunction);
  }
  const result = createDOMAdapter(options.renderCell);

  return result;
}
/**
 * sample
 *
 * Normalize a browser pointer event into a gesture sample.
 * @param event The incoming event.
 * @returns The pointer coordinates, identifier, and timestamp.
 */
function sample(event: PointerEvent): PointerSample {
  const result: PointerSample = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };

  return result;
}
/**
 * Functional public controller operations with terminal, idempotent cleanup.
 */
export interface SwipeEngine<T> {
  /**
   * getPosition
   *
   * Read the immutable last committed grid position.
   * @returns The resulting cell coordinates.
   */
  readonly getPosition: () => Position;
  /**
   * navigate
   *
   * Request one neighboring transition without queuing conflicting commands.
   * @param direction The requested navigation direction.
   * @returns A promise that resolves to whether the operation succeeded.
   */
  readonly navigate: (direction: Direction) => Promise<boolean>;
  /**
   * goTo
   *
   * Commit a valid target position without traversing intermediate cells.
   * @param position Zero based cell coordinates.
   * @returns A promise that resolves to whether the operation succeeded.
   */
  readonly goTo: (position: Position) => Promise<boolean>;
  /**
   * updateGrid
   *
   * Validate and replace the grid, clamp coordinates when necessary, and synchronize owned resources.
   * @param grid Grid rows and their cell data.
   */
  readonly updateGrid: (grid: Grid<T>) => void;
  /**
   * destroy
   *
   * Release owned resources once and settle pending work without leaving stale callbacks.
   */
  readonly destroy: () => void;
}
/**
 * createSwipeEngine
 *
 * Connect navigation, gesture handling, and rendering through an independent functional controller.
 * @param options Validated container, grid, rendering strategy, and optional lifecycle callbacks.
 * @returns Independent operations that can be called without binding a receiver.
 */
export function createSwipeEngine<T>(options: SwipeEngineOptions<T>): SwipeEngine<T> {
  let stateModel: NavigationModel<T> | null = null;
  let stateRenderer: DOMRenderer | null = null;
  let stateGesture: GestureEngine | null = null;
  let stateContainer: HTMLElement | null = null;
  let stateView: (Window & typeof globalThis) | null = null;
  let statePosition: Position = ORIGIN_POSITION;
  let stateOnChange: ((position: Position, previous: Position) => void) | undefined;
  let stateReporter: ((error: Error) => void) | null = null;
  let stateSubscriptions: Subscription[] = [];
  let stateCapture: Capture | null = null;
  let stateTransaction: Transition | null = null;
  let stateDestroyed = false;
  let stateMutating = true;
  let stateSuppressClick = false;
  let stateOwnsMarker = false;
  let statePreviousMarker: string | null = null;
  let stateWheelTime: number | null = null;
  /**
   * stateWheel
   *
   * Consume one vertical transition per wheel burst only inside the owned cell viewport.
   * @param event The incoming event.
   */
  const stateWheel = (event: Event): void => {
    guardEvent(() => {
      const wheel = event as WheelEvent;
      if (
        event.defaultPrevented ||
        wheel.ctrlKey ||
        wheel.metaKey ||
        wheel.shiftKey ||
        !Number.isFinite(wheel.deltaY) ||
        !Number.isFinite(wheel.deltaX) ||
        wheel.deltaY === 0 ||
        Math.abs(wheel.deltaY) <= Math.abs(wheel.deltaX) ||
        !ownsEvent(event) ||
        !readVisible()
      )
        return;
      const viewport = stateContainer?.querySelector(CORE_TEXT.scopeDataTikitakiViewport);
      if (!viewport || !event.composedPath().includes(viewport)) return;
      if (event.cancelable) event.preventDefault();
      const previous = stateWheelTime;
      stateWheelTime = event.timeStamp;
      if (readBusy() || (previous !== null && event.timeStamp - previous < WHEEL_IDLE_MS)) return;
      const direction = wheel.deltaY > 0 ? CORE_TEXT.up : CORE_TEXT.down;
      const reporter = stateReporter;
      void navigate(direction).catch((error: unknown) => {
        reporter?.(errorFrom(error));
      });
    });
  };
  /**
   * stateDown
   *
   * Accept an eligible primary pointer and acquire capture on its original element.
   * @param event The incoming event.
   */
  const stateDown = (event: Event): void => {
    guardEvent(() => {
      const pointer = event as PointerEvent;
      const gesture = stateGesture;
      if (
        readBusy() ||
        !readVisible() ||
        gesture === null ||
        !ownsEvent(event) ||
        pointer.button !== 0 ||
        !pointer.isPrimary ||
        !POINTER_TYPES.includes(pointer.pointerType)
      )
        return;

      if (!gesture.pointerDown(sample(pointer))) return;

      stateSuppressClick = false;
      const view = stateView;
      const container = stateContainer;
      if (view === null || container === null) return;

      const target =
        event
          .composedPath()
          .find((node): node is Element => node instanceof view.Element && typeof node.setPointerCapture === 'function') ?? container;
      stateCapture = { element: target, id: pointer.pointerId };
      try {
        target.setPointerCapture(pointer.pointerId);
      } catch (error) {
        stateCapture = null;
        if (!isNotFound(error)) {
          throw error;
        }
        refreshGesture();
        stateRenderer?.reset();
      }
    });
  };
  /**
   * stateMove
   *
   * Forward pointer movement and schedule drag rendering on the locked axis.
   * @param event The incoming event.
   */
  const stateMove = (event: Event): void => {
    guardEvent(() => {
      const gesture = stateGesture;
      if (gesture?.pointerMove(sample(event as PointerEvent))) {
        const snapshot = gesture.getSnapshot();
        if (snapshot.state === CORE_TEXT.dragging) {
          stateSuppressClick = true;
          if (event.cancelable) {
            event.preventDefault();
          }
          stateRenderer?.setOffset(snapshot.offset);
        }
      }
    });
  };
  /**
   * stateUp
   *
   * Finish the active pointer and launch its settlement plan.
   * @param event The incoming event.
   */
  const stateUp = (event: Event): void => {
    guardEvent(() => {
      finishPointer(event as PointerEvent, false);
    });
  };
  /**
   * stateCancel
   *
   * Roll back a cancelled pointer without committing a grid position.
   * @param event The incoming event.
   */
  const stateCancel = (event: Event): void => {
    guardEvent(() => {
      finishPointer(event as PointerEvent, true);
    });
  };
  /**
   * stateLost
   *
   * Release a pointer whose native capture ownership was lost.
   * @param event The incoming event.
   */
  const stateLost = (event: Event): void => {
    guardEvent(() => {
      dropCapture((event as PointerEvent).pointerId);
    });
  };
  /**
   * stateVerifyCapture
   *
   * Detect removed capture targets before accepting subsequent pointer events.
   * @param event The incoming event.
   */
  const stateVerifyCapture = (event: Event): void => {
    guardEvent(() => {
      const pointer = event as PointerEvent;
      const capture = stateCapture;
      if (capture?.id !== pointer.pointerId) return;

      // A removed pending capture target may disappear without a lostcapture event.
      if (!capture.element.isConnected || !capture.element.hasPointerCapture(capture.id)) {
        dropCapture(capture.id);
      }
    });
  };
  /**
   * stateClick
   *
   * Suppress the accidental pointer click following a drag while preserving keyboard activation.
   * @param event The incoming event.
   */
  const stateClick = (event: Event): void => {
    if (stateSuppressClick && (event as MouseEvent).detail > 0 && ownsEvent(event)) {
      stateSuppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };
  /**
   * stateNativeDrag
   *
   * Prevent native drag and selection only while this controller owns an active gesture.
   * @param event The incoming event.
   */
  const stateNativeDrag = (event: Event): void => {
    const state = stateGesture?.getSnapshot().state;
    if ((state === CORE_TEXT.tracking || state === CORE_TEXT.dragging) && ownsEvent(event)) {
      event.preventDefault();
    }
  };
  /**
   * getPosition
   *
   * Read the immutable last committed grid position.
   * @returns The resulting cell coordinates.
   */
  function getPosition(): Position {
    return statePosition;
  }
  /**
   * navigate
   *
   * Request one neighboring transition without queuing conflicting commands.
   * @param direction The requested navigation direction.
   * @returns A promise that resolves to whether the operation succeeded.
   */
  function navigate(direction: Direction): Promise<boolean> {
    if (stateDestroyed || stateModel === null) {
      const result = Promise.resolve(false);

      return result;
    }
    try {
      const target = stateModel.getNeighbor(direction);
      if (readBusy() || target === null || !readVisible()) {
        const result = Promise.resolve(false);

        return result;
      }
      const size = stateRenderer?.getSize();
      if (size === undefined) {
        const result = Promise.resolve(false);

        return result;
      }
      const to = {
        x: direction === CORE_TEXT.left ? -size.width : direction === CORE_TEXT.right ? size.width : 0,
        y: direction === CORE_TEXT.up ? -size.height : direction === CORE_TEXT.down ? size.height : 0,
      };
      const result = start(
        { direction, from: { x: 0, y: 0 }, to, duration: stateGesture?.getOptions().animationDuration ?? 0 },
        target,
        null,
      );

      return result;
    } catch (error) {
      const result = Promise.reject(errorFrom(error));

      return result;
    }
  }
  /**
   * goTo
   *
   * Commit a valid target position without traversing intermediate cells.
   * @param position Zero based cell coordinates.
   * @returns A promise that resolves to whether the operation succeeded.
   */
  function goTo(position: Position): Promise<boolean> {
    if (stateDestroyed || stateModel === null) {
      const result = Promise.resolve(false);

      return result;
    }
    try {
      stateModel.getItem(position); // Validate without changing or interrupting state.
      if (readBusy() || (position.row === statePosition.row && position.col === statePosition.col)) {
        const result = Promise.resolve(false);

        return result;
      }
      const result = Promise.resolve(commit(position));

      return result;
    } catch (error) {
      const result = Promise.reject(errorFrom(error));

      return result;
    }
  }
  /**
   * updateGrid
   *
   * Validate and replace the grid, clamp coordinates when necessary, and synchronize owned resources.
   * @param grid Grid rows and their cell data.
   */
  function updateGrid(grid: Grid<T>): void {
    if (stateDestroyed || stateModel === null || stateRenderer === null) return;

    if (stateMutating) {
      throw new Error(CORE_TEXT.cannotUpdateGridDuringCellLifecycle);
    }
    const model = stateModel;
    const renderer = stateRenderer;
    const previous = statePosition;
    let applied = false;
    stateMutating = true;
    try {
      model.updateGrid(grid);
      applied = true;
      if (!isAlive()) return;

      interrupt(false);
      renderer.sync();
      if (!isAlive()) return;

      statePosition = model.getPosition();
      refreshGesture();
    } catch (error) {
      if (applied) {
        throw fatal(error);
      }
      throw error;
    } finally {
      stateMutating = false;
    }
    if (statePosition.row !== previous.row || statePosition.col !== previous.col) {
      stateOnChange?.(statePosition, previous);
    }
  }
  /**
   * destroy
   *
   * Release owned resources once and settle pending work without leaving stale callbacks.
   */
  function destroy(): void {
    if (stateDestroyed) return;

    stateDestroyed = true;
    const transaction = stateTransaction;
    stateTransaction = null;
    transaction?.resolve(false);
    const errors: unknown[] = [];
    /**
     * attempt
     * @param callback The callback invoked by this operation.
     */
    const attempt = (callback: () => void): void => {
      try {
        callback();
      } catch (error) {
        errors.push(error);
      }
    };
    const gesture = stateGesture;
    stateGesture = null;
    if (gesture !== null) {
      gesture.destroy();
    }
    const subscriptions = stateSubscriptions;
    stateSubscriptions = [];
    for (const subscription of subscriptions)
      attempt(() => {
        subscription.target.removeEventListener(subscription.type, subscription.listener, subscription.capture);
      });
    attempt(() => {
      releaseCapture();
    });
    const renderer = stateRenderer;
    stateRenderer = null;
    if (renderer !== null) {
      attempt(() => {
        renderer.destroy();
      });
    }
    const container = stateContainer;
    if (container !== null && stateOwnsMarker && container.getAttribute(CORE_TEXT.dataTikitakiEngine) === CORE_TEXT.empty) {
      attempt(() => {
        if (statePreviousMarker === null) {
          container.removeAttribute(CORE_TEXT.dataTikitakiEngine);
        } else {
          container.setAttribute(CORE_TEXT.dataTikitakiEngine, statePreviousMarker);
        }
      });
    }
    stateWheelTime = null;
    stateModel = null;
    stateContainer = null;
    stateView = null;
    stateOnChange = undefined;
    stateReporter = null;
    stateOwnsMarker = false;
    if (errors.length !== 0) {
      throw new AggregateError(errors, CORE_TEXT.swipeEngineCleanupFailed);
    }
  }
  /**
   * isAlive
   *
   * Check disposal state after a potentially reentrant lifecycle callback.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function isAlive(): boolean {
    const result = !stateDestroyed;

    return result;
  }
  /**
   * readVisible
   *
   * Check cached viewport dimensions before accepting animated input.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function readVisible(): boolean {
    const size = stateRenderer?.getSize();
    const result = size !== undefined && size.width > 0 && size.height > 0;

    return result;
  }
  /**
   * readBusy
   *
   * Check structural mutation, gesture tracking, and pending transition ownership.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function readBusy(): boolean {
    const result =
      stateMutating || stateTransaction !== null || (stateGesture !== null && stateGesture.getSnapshot().state !== CORE_TEXT.idle);

    return result;
  }
  /**
   * context
   *
   * Build a positive gesture context from cached size and currently available neighbors.
   * @returns The viewport dimensions and available neighboring directions.
   */
  function context(): GestureContext {
    const model = stateModel;
    const size = stateRenderer?.getSize();
    const result: GestureContext = {
      width: Math.max(1, size?.width ?? 1),
      height: Math.max(1, size?.height ?? 1),
      neighbors: {
        up: model !== null && model.getNeighbor(CORE_TEXT.up) !== null,
        down: model !== null && model.getNeighbor(CORE_TEXT.down) !== null,
        left: model !== null && model.getNeighbor(CORE_TEXT.left) !== null,
        right: model !== null && model.getNeighbor(CORE_TEXT.right) !== null,
      },
    };

    return result;
  }
  /**
   * refreshGesture
   *
   * Reset gesture ownership against the latest viewport and navigation snapshot.
   */
  function refreshGesture(): void {
    stateGesture?.updateContext(context());
  }
  /**
   * interrupt
   *
   * Resolve the current transaction as cancelled and release pointer ownership.
   * @param resetRenderer The reset renderer argument.
   */
  function interrupt(resetRenderer: boolean): void {
    const transaction = stateTransaction;
    stateTransaction = null;
    transaction?.resolve(false);
    refreshGesture();
    releaseCapture();
    if (resetRenderer) {
      stateRenderer?.reset();
    }
  }
  /**
   * start
   *
   * Own one cancellable visual transition and ignore completions from stale transactions.
   * @param plan The plan argument.
   * @param target The requested target.
   * @param gesture The gesture argument.
   * @returns A promise that resolves to whether the operation succeeded.
   */
  function start(plan: GestureSettlement, target: Position | null, gesture: GestureSettlement | null): Promise<boolean> {
    const renderer = stateRenderer;
    if (renderer === null) {
      const result = Promise.resolve(false);

      return result;
    }
    const result = new Promise<boolean>((resolve, reject) => {
      const transaction: Transition = { target, gesture, resolve, reject };
      stateTransaction = transaction;
      try {
        void renderer.animate(plan).then(
          (completed) => {
            finish(transaction, completed);
          },
          (error: unknown) => {
            animationError(transaction, error);
          },
        );
      } catch (error) {
        animationError(transaction, error);
      }
    });

    return result;
  }
  /**
   * finish
   *
   * Commit only the current successfully completed transition or finish its rollback.
   * @param transaction The transaction argument.
   * @param completed The completed argument.
   */
  function finish(transaction: Transition, completed: boolean): void {
    if (stateTransaction !== transaction || stateDestroyed) return;

    try {
      if (!completed || (transaction.gesture !== null && !stateGesture?.finishSettling(transaction.gesture))) {
        interrupt(true);

        return;
      }
      if (transaction.target === null) {
        stateTransaction = null;
        refreshGesture();
        transaction.resolve(false);

        return;
      }
      transaction.resolve(commit(transaction.target, transaction));
    } catch (error) {
      transaction.reject(errorFrom(error));
    }
  }
  /**
   * animationError
   *
   * Reject the current failed animation and release all controller resources.
   * @param transaction The transaction argument.
   * @param error The failure to report or normalize.
   */
  function animationError(transaction: Transition, error: unknown): void {
    if (stateTransaction !== transaction) return;

    stateTransaction = null;
    transaction.reject(fatal(error));
  }
  /**
   * commit
   *
   * Synchronize the target hosts before publishing the position and invoking its callback.
   * @param position Zero based cell coordinates.
   * @param transaction The transaction argument.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function commit(position: Position, transaction?: Transition): boolean {
    const model = stateModel;
    const renderer = stateRenderer;
    if (model === null || renderer === null) {
      const result = false;

      return result;
    }
    const previous = statePosition;
    stateMutating = true;
    try {
      model.goTo(position);
      renderer.sync();
      if (stateDestroyed || (transaction !== undefined && stateTransaction !== transaction)) {
        const result = false;

        return result;
      }
      statePosition = model.getPosition();
      if (transaction !== undefined) {
        stateTransaction = null;
      }
      refreshGesture();
    } catch (error) {
      if (transaction !== undefined && stateTransaction === transaction) {
        stateTransaction = null;
      }
      throw fatal(error);
    } finally {
      stateMutating = false;
    }
    stateOnChange?.(statePosition, previous);
    const result = true;

    return result;
  }
  /**
   * releaseCapture
   *
   * Release the original pointer capture while tolerating native NotFoundError races.
   */
  function releaseCapture(): void {
    const capture = stateCapture;
    stateCapture = null;
    if (capture === null) return;

    try {
      if (capture.element.hasPointerCapture(capture.id)) {
        capture.element.releasePointerCapture(capture.id);
      }
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }
  /**
   * dropCapture
   *
   * Invalidate lost pointer ownership and launch a rollback when dragging had begun.
   * @param id The id argument.
   */
  function dropCapture(id: number): void {
    if (stateCapture?.id !== id) return;

    const plan = stateGesture?.lostPointerCapture(id) ?? null;
    releaseCapture();
    launch(plan);
  }
  /**
   * ownsEvent
   *
   * Resolve the innermost owning controller from the event composed path.
   * @param event The incoming event.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function ownsEvent(event: Event): boolean {
    const view = stateView;
    const container = stateContainer;
    if (view === null || container === null) {
      const result = false;

      return result;
    }
    const owner = event
      .composedPath()
      .find(
        (node) =>
          node instanceof view.HTMLElement &&
          node.hasAttribute(CORE_TEXT.dataTikitakiEngine) &&
          node.querySelector(CORE_TEXT.scopeDataTikitakiViewport) !== null,
      );
    const result = owner === container;

    return result;
  }
  /**
   * listen
   *
   * Register a removable listener and record its exact target and capture mode.
   * @param target The requested target.
   * @param type The type argument.
   * @param listener The listener to register.
   * @param capture The capture argument.
   */
  function listen(target: EventTarget, type: string, listener: EventListener, capture = false): void {
    target.addEventListener(type, listener, { capture, passive: false });
    stateSubscriptions.push({ target, type, listener, capture });
  }
  /**
   * guardEvent
   *
   * Report browser event failures after completing terminal resource cleanup.
   * @param callback The callback invoked by this operation.
   */
  function guardEvent(callback: () => void): void {
    if (stateDestroyed) return;

    const reporter = stateReporter;
    try {
      callback();
    } catch (error) {
      reporter?.(fatal(error));
    }
  }
  /**
   * launch
   *
   * Start a gesture owned settlement and route asynchronous failures to the error reporter.
   * @param plan The plan argument.
   */
  function launch(plan: GestureSettlement | null): void {
    if (plan === null) return;

    const reporter = stateReporter;
    const target = plan.direction === null ? null : (stateModel?.getNeighbor(plan.direction) ?? null);
    void start(plan, target, plan).catch((error: unknown) => {
      reporter?.(errorFrom(error));
    });
  }
  /**
   * fatal
   *
   * Normalize an operation failure and aggregate any cleanup failures without skipping cleanup.
   * @param error The failure to report or normalize.
   * @returns The operation error combined with any cleanup failures.
   */
  function fatal(error: unknown): Error {
    const failure = errorFrom(error);
    try {
      destroy();
    } catch (cleanupError) {
      const result = new AggregateError([failure, cleanupError], CORE_TEXT.swipeEngineOperationAndCleanupFailed, { cause: cleanupError });

      return result;
    }

    return failure;
  }
  /**
   * finishPointer
   *
   * Complete or cancel the owned pointer, release capture, and launch its settlement.
   * @param pointer The pointer argument.
   * @param cancelled The cancelled argument.
   */
  function finishPointer(pointer: PointerEvent, cancelled: boolean): void {
    const gesture = stateGesture;
    if (gesture?.getSnapshot().pointerId !== pointer.pointerId) return;

    const plan = cancelled ? gesture.pointerCancel(pointer.pointerId) : gesture.pointerUp(sample(pointer));
    if (plan !== null && !cancelled) {
      stateSuppressClick = true;
    }
    if (gesture.getSnapshot().pointerId === null) {
      releaseCapture();
    }
    launch(plan);
  }
  const input = object(options, CORE_TEXT.swipeEngineOptions);
  if (!isHTMLElement(input.container)) {
    throw new TypeError(CORE_TEXT.containerMustBeAnHTMLElement);
  }
  const { container } = options;
  const view = container.ownerDocument.defaultView;
  if (
    view === null ||
    typeof container.setPointerCapture !== 'function' ||
    typeof container.releasePointerCapture !== 'function' ||
    typeof container.hasPointerCapture !== 'function'
  ) {
    throw new TypeError(CORE_TEXT.anActiveDocumentWithPointerCaptureIsRequired);
  }
  for (const key of [CORE_TEXT.onPositionChange, CORE_TEXT.onError] as const) {
    if (input[key] !== undefined && typeof input[key] !== 'function') {
      throw new TypeError(CORE_MESSAGES.callback(key));
    }
  }
  const adapter = resolveAdapter(options);
  const model = createNavigationModel(options.grid, options.initialPosition);
  statePosition = model.getPosition();
  stateModel = model;
  stateContainer = container;
  stateView = view;
  stateOnChange = options.onPositionChange;
  const onError = options.onError;
  /**
   * fallback
   * @param error The failure to report or normalize.
   */
  const fallback = (error: Error): void => {
    if (typeof view.reportError === 'function') {
      view.reportError(error);
    } else {
      view.dispatchEvent(new view.ErrorEvent(CORE_TEXT.error, { error, message: error.message, cancelable: true }));
    }
  };
  stateReporter = (error) => {
    try {
      if (onError !== undefined) {
        onError(error);
      } else {
        fallback(error);
      }
    } catch (reportError) {
      fallback(errorFrom(reportError));
    }
  };
  try {
    // Positive placeholder dimensions allow hidden containers; input stays suspended.
    stateGesture = createGestureEngine(context(), options.gesture);
    stateRenderer = createDOMRenderer({
      container,
      navigation: model,
      adapter,
      /**
       * onResize
       */
      onResize: () => {
        guardEvent(() => {
          interrupt(false);
        });
      },
    });
    refreshGesture();
    statePreviousMarker = container.getAttribute(CORE_TEXT.dataTikitakiEngine);
    container.setAttribute(CORE_TEXT.dataTikitakiEngine, CORE_TEXT.empty);
    stateOwnsMarker = true;
    listen(container, CORE_TEXT.wheel, stateWheel);
    listen(container, CORE_TEXT.pointerdown, stateDown);
    listen(container, CORE_TEXT.pointermove, stateMove);
    listen(container, CORE_TEXT.pointerup, stateUp);
    listen(container, CORE_TEXT.pointercancel, stateCancel);
    for (const type of [CORE_TEXT.pointermove, CORE_TEXT.pointerup, CORE_TEXT.pointercancel]) {
      listen(view, type, stateVerifyCapture, true);
    }
    listen(view, CORE_TEXT.lostpointercapture, stateLost, true);
    listen(container, CORE_TEXT.click, stateClick, true);
    listen(container, CORE_TEXT.dragstart, stateNativeDrag);
    listen(container, CORE_TEXT.selectstart, stateNativeDrag);
    stateMutating = false;
  } catch (error) {
    throw fatal(error);
  }
  const api: SwipeEngine<T> = { getPosition, navigate, goTo, updateGrid, destroy };

  return api;
}
