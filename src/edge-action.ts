import { DIRECTIONS, ZERO_OFFSET, DEFAULT_EDGE_ACTION_OPTIONS, CORE_TEXT } from './config';
import type { Direction, Position } from './navigation';
import type { GestureOffset, GestureSettlement } from './gesture';
import type { RendererSize } from './dom-renderer';

/** Observable stages of a boundary pull and its asynchronous action. */
export type EdgeActionPhase = 'idle' | 'pulling' | 'armed' | 'loading' | 'returning';

/** Immutable state for an application owned boundary indicator. */
export interface EdgeActionState {
  readonly phase: EdgeActionPhase;
  readonly direction: Direction;
  readonly position: Position;
  /** Visible displacement along the configured direction in CSS pixels. */
  readonly offset: number;
  /** Pull progress clamped to the closed unit interval. */
  readonly progress: number;
}

/** Request context whose signal is aborted when the engine cancels the action. */
export interface EdgeActionContext {
  readonly direction: Direction;
  readonly position: Position;
  readonly signal: AbortSignal;
}

/** Optional boundary action with distances measured after elastic resistance in CSS pixels. */
export interface EdgeActionOptions {
  readonly direction: Direction;
  /** Return to the home cell after a triggered action settles with a default of false. */
  readonly returnToPrimary?: boolean;
  /** Positive visible pull distance required on release with a default of 72. */
  readonly threshold?: number;
  /** Positive displacement held during loading with a default of 64. */
  readonly holdOffset?: number;
  /**
   * enabled. Select the cells where a missing neighbor can trigger the action.
   * @param position The current committed cell coordinates.
   * @returns Whether this cell accepts the boundary action.
   */
  readonly enabled?: (position: Position) => boolean;
  /**
   * onTrigger. Run the application operation once after an armed release.
   * @param context The selected boundary and cancellation signal.
   * @returns A promise that settles when the operation finishes.
   */
  readonly onTrigger: (context: EdgeActionContext) => Promise<void>;
  /**
   * onStateChange. Update an application owned indicator without changing the grid.
   * @param state The immutable boundary action state.
   */
  readonly onStateChange?: (state: EdgeActionState) => void;
}

/** Internal bridge to the controller without framework or network dependencies. */
export interface EdgeActionHost {
  /**
   * getPosition. Read the committed cell coordinates.
   * @returns The current position.
   */
  readonly getPosition: () => Position;
  /**
   * hasNeighbor. Check whether a direction already has a navigable cell.
   * @param direction The finger movement direction.
   * @returns Whether a neighbor exists.
   */
  readonly hasNeighbor: (direction: Direction) => boolean;
  /**
   * getSize. Read cached viewport dimensions.
   * @returns The viewport dimensions in CSS pixels.
   */
  readonly getSize: () => RendererSize;
  /**
   * animate. Animate a partial displacement with the controller duration.
   * @param from The starting displacement.
   * @param to The final displacement.
   * @returns Whether the animation completed.
   */
  readonly animate: (from: GestureOffset, to: GestureOffset) => Promise<boolean>;
  /**
   * setOffset. Restore displacement after a grid update.
   * @param offset The displacement to render.
   */
  readonly setOffset: (offset: GestureOffset) => void;
  /**
   * complete. Reset the gesture and optionally select the primary cell.
   * @param returnToPrimary Whether a triggered action requests the primary cell.
   */
  readonly complete: (returnToPrimary: boolean) => void;
  /**
   * report. Report an operation error while keeping navigation available.
   * @param error The original error from the callback.
   */
  readonly report: (error: unknown) => void;
}

/** Internal lifecycle used by one independent swipe controller. */
export interface EdgeAction {
  /**
   * track. Publish progress for an eligible elastic boundary pull.
   * @param offset The visible gesture displacement.
   */
  readonly track: (offset: GestureOffset) => void;
  /**
   * release. Consume an active boundary pull and begin loading or rollback.
   * @param plan The gesture settlement token.
   * @param cancelled Whether the pointer was cancelled or lost capture.
   * @returns Whether the boundary action owns settlement.
   */
  readonly release: (plan: GestureSettlement, cancelled: boolean) => boolean;
  /**
   * isBusy. Check loading or return animation ownership.
   * @returns Whether a boundary operation is running.
   */
  readonly isBusy: () => boolean;
  /**
   * restore. Restore the held offset after updating the same cell.
   */
  readonly restore: () => void;
  /**
   * cancel. Abort pending work and clear the indicator.
   */
  readonly cancel: () => void;
}

/**
 * createEdgeAction. Create optional boundary action ownership and validate its configuration.
 * @param options The optional application callbacks and boundary tuning.
 * @param host The controller operations used to render and cancel work.
 * @returns Independent boundary operations or null when disabled.
 */
export function createEdgeAction(options: EdgeActionOptions | undefined, host: EdgeActionHost): EdgeAction | null {
  if (options === undefined) return null;
  const input: unknown = options;
  if (typeof input !== 'object' || input === null || Array.isArray(input) || !DIRECTIONS.includes(options.direction)) {
    throw new TypeError(CORE_TEXT.edgeActionDirection);
  }
  if (
    typeof options.onTrigger !== 'function' ||
    (options.enabled !== undefined && typeof options.enabled !== 'function') ||
    (options.onStateChange !== undefined && typeof options.onStateChange !== 'function')
  ) {
    throw new TypeError(CORE_TEXT.edgeActionCallbacks);
  }
  if (options.returnToPrimary !== undefined && typeof options.returnToPrimary !== 'boolean') {
    throw new TypeError(CORE_TEXT.edgeActionReturn);
  }
  const returnToPrimary = options.returnToPrimary ?? false;
  const values = input as Record<string, unknown>;
  const rawThreshold = values.threshold === undefined ? DEFAULT_EDGE_ACTION_OPTIONS.threshold : values.threshold;
  const rawHoldOffset = values.holdOffset === undefined ? DEFAULT_EDGE_ACTION_OPTIONS.holdOffset : values.holdOffset;
  if (
    typeof rawThreshold !== 'number' ||
    !Number.isFinite(rawThreshold) ||
    rawThreshold <= 0 ||
    typeof rawHoldOffset !== 'number' ||
    !Number.isFinite(rawHoldOffset) ||
    rawHoldOffset <= 0
  ) {
    throw new RangeError(CORE_TEXT.edgeActionDistances);
  }
  const threshold = rawThreshold;
  const holdOffset = rawHoldOffset;
  const { direction, enabled, onTrigger, onStateChange } = options;
  let phase: EdgeActionPhase = 'idle';
  let offset = ZERO_OFFSET;
  let position = host.getPosition();
  let operation: AbortController | null = null;

  /**
   * distance. Read signed displacement along the configured boundary.
   * @param value The visible gesture displacement.
   * @returns The displacement toward the configured boundary.
   */
  function distance(value: GestureOffset): number {
    const result = direction === 'down' ? value.y : direction === 'up' ? -value.y : direction === 'right' ? value.x : -value.x;

    return result;
  }
  /**
   * publish. Notify the application with an immutable progress snapshot.
   * @param next The next boundary action phase.
   */
  function publish(next: EdgeActionPhase): void {
    phase = next;
    const visible = Math.max(0, distance(offset));
    try {
      onStateChange?.(Object.freeze({ phase, direction, position, offset: visible, progress: Math.min(1, visible / threshold) }));
    } catch (error) {
      host.report(error);
    }
  }
  /**
   * track. Update eligibility and progress using the latest visible pull.
   * @param value The elastic gesture displacement.
   */
  function track(value: GestureOffset): void {
    if (operation !== null) return;
    position = host.getPosition();
    const eligible = distance(value) > 0 && !host.hasNeighbor(direction) && (enabled?.(position) ?? true);
    offset = eligible ? value : ZERO_OFFSET;
    if (eligible) {
      publish(distance(value) >= threshold ? 'armed' : 'pulling');
    } else if (phase !== 'idle') {
      publish('idle');
    }
  }
  /**
   * run. Hold a triggered action and return smoothly after it settles.
   * @param owner The cancellation token that owns this operation.
   * @param from The release displacement.
   * @param trigger Whether release crossed the required visible distance.
   * @returns A promise that settles after the return animation.
   */
  async function run(owner: AbortController, from: GestureOffset, trigger: boolean): Promise<void> {
    try {
      if (trigger) {
        const size = host.getSize();
        const amount = Math.min(holdOffset, direction === 'up' || direction === 'down' ? size.height : size.width);
        offset = Object.freeze({
          x: direction === 'left' ? -amount : direction === 'right' ? amount : 0,
          y: direction === 'up' ? -amount : direction === 'down' ? amount : 0,
        });
        publish('loading');
        if (operation !== owner) return;
        let work: Promise<void>;
        try {
          work = Promise.resolve(onTrigger(Object.freeze({ direction, position, signal: owner.signal })));
        } catch (error) {
          work = Promise.reject(error instanceof Error ? error : new Error(CORE_TEXT.edgeActionFailed, { cause: error }));
        }
        const settled = work.catch((error: unknown) => {
          if (operation === owner) host.report(error);
        });
        if (operation !== owner) return;
        await host.animate(from, offset);
        if (operation !== owner) return;
        await settled;
      }
      if (operation !== owner) return;
      const origin = trigger ? offset : from;
      publish('returning');
      if (operation !== owner) return;
      await host.animate(origin, ZERO_OFFSET);
      if (operation !== owner) return;
      operation = null;
      offset = ZERO_OFFSET;
      publish('idle');
      host.complete(trigger && returnToPrimary);
    } catch (error) {
      if (operation !== owner) return;
      cancel();
      host.complete(false);
      host.report(error);
    }
  }
  /**
   * release. Take ownership only when the configured missing boundary was pulled.
   * @param plan The gesture settlement token.
   * @param cancelled Whether the pointer was cancelled.
   * @returns Whether the ordinary settlement has been replaced.
   */
  function release(plan: GestureSettlement, cancelled: boolean): boolean {
    track(plan.from);
    if (operation !== null || phase === 'idle') return false;
    const trigger = !cancelled && phase === 'armed';
    const owner = new AbortController();
    operation = owner;
    void run(owner, plan.from, trigger);

    return true;
  }
  /**
   * isBusy. Read asynchronous boundary ownership.
   * @returns Whether an operation is loading or returning.
   */
  function isBusy(): boolean {
    return operation !== null;
  }
  /**
   * restore. Keep a loading indicator open when its cell data changes.
   */
  function restore(): void {
    if (operation !== null) host.setOffset(offset);
  }
  /**
   * cancel. Release ownership before aborting application work and notifying cleanup.
   */
  function cancel(): void {
    const owner = operation;
    operation = null;
    offset = ZERO_OFFSET;
    owner?.abort();
    if (phase !== 'idle') publish('idle');
  }
  const api: EdgeAction = { track, release, isBusy, restore, cancel };

  return api;
}
