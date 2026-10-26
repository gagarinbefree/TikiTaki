import { CORE_TEXT, CORE_MESSAGES } from './config';
import {
  DEFAULT_GESTURE_OPTIONS,
  ZERO_OFFSET,
  VELOCITY_WINDOW_MS,
  SAMPLE_INTERVAL_MS,
  MAX_SAMPLES,
  MIN_MOTION_SAMPLES,
  PREVIOUS_MOTION_INDEX,
} from './config';
import type { Direction } from './navigation';
/**
 * Validated gesture tuning values; distances use CSS pixels and times use milliseconds.
 */
export interface GestureOptions {
  /** Positive finite commit distance in CSS pixels; defaults to DEFAULT_GESTURE_OPTIONS.distanceThreshold. */
  readonly distanceThreshold: number;
  /** Positive finite flick velocity in CSS pixels per millisecond; defaults to DEFAULT_GESTURE_OPTIONS.velocityThreshold. */
  readonly velocityThreshold: number;
  /** Positive finite dead zone distance in CSS pixels; defaults to DEFAULT_GESTURE_OPTIONS.axisLockThreshold. */
  readonly axisLockThreshold: number;
  /** Finite nonnegative settlement duration in milliseconds; defaults to DEFAULT_GESTURE_OPTIONS.animationDuration. */
  readonly animationDuration: number;
  /** Finite elastic resistance ratio in the closed unit interval; defaults to DEFAULT_GESTURE_OPTIONS.edgeResistance. */
  readonly edgeResistance: number;
}
export type GestureState = 'idle' | 'tracking' | 'dragging' | 'settling';
export type GestureAxis = 'x' | 'y';
/** Normalized pointer identity, CSS pixel coordinates, and a monotonic timestamp in milliseconds. */
export interface PointerSample {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly time: number;
}
/** Validated positive viewport geometry and immutable neighbor availability. */
export interface GestureContext {
  readonly width: number;
  readonly height: number;
  readonly neighbors: Readonly<Record<Direction, boolean>>;
}
/** An immutable axis aligned displacement measured in CSS pixels. */
export interface GestureOffset {
  readonly x: number;
  readonly y: number;
}
/** Observable gesture phase, axis, pointer ownership, displacement, and disposal state. */
export interface GestureSnapshot {
  readonly state: GestureState;
  readonly axis: GestureAxis | null;
  readonly pointerId: number | null;
  readonly offset: GestureOffset;
  readonly destroyed: boolean;
}
/** An identity bearing animation plan for committing a neighbor or rolling back. */
export interface GestureSettlement {
  readonly direction: Direction | null;
  readonly from: GestureOffset;
  readonly to: GestureOffset;
  readonly duration: number;
}
export { DEFAULT_GESTURE_OPTIONS } from './config';
/** One timestamped axis coordinate retained for recent velocity estimation. */
interface MotionSample {
  readonly coordinate: number;
  readonly time: number;
}
/** Private tracking history for the pointer currently owned by one gesture engine. */
interface ActiveGesture {
  readonly start: PointerSample;
  last: PointerSample;
  motionSign: number;
  samples: MotionSample[];
}
/**
 * record
 *
 * Validate an object shaped runtime input before reading its fields.
 * @param value The value to process.
 * @param label The label used in validation messages.
 * @returns The validated object with readable fields.
 */
function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(CORE_MESSAGES.object(label));
  }
  const result = value as Record<string, unknown>;

  return result;
}
/**
 * finiteNumber
 *
 * Validate a finite numeric input without coercion.
 * @param value The value to process.
 * @param label The label used in validation messages.
 * @returns The computed numeric value.
 */
function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number') {
    throw new TypeError(CORE_MESSAGES.numeric(label));
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(CORE_MESSAGES.finite(label));
  }

  return value;
}
/**
 * resolveOptions
 *
 * Merge gesture overrides with central defaults and validate every supported option.
 * @param input The input argument.
 * @returns The validated gesture options.
 */
function resolveOptions(input: unknown): Readonly<GestureOptions> {
  const overrides = input === undefined ? {} : record(input, CORE_TEXT.gestureOptions);
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(DEFAULT_GESTURE_OPTIONS, key)) {
      throw new TypeError(CORE_MESSAGES.option(key));
    }
  }
  /**
   * option
   * @param key The stable record identifier.
   * @returns The computed numeric value.
   */
  const option = (key: keyof GestureOptions): number =>
    finiteNumber(Object.hasOwn(overrides, key) ? overrides[key] : DEFAULT_GESTURE_OPTIONS[key], key);
  const options: GestureOptions = {
    distanceThreshold: option(CORE_TEXT.distanceThreshold),
    velocityThreshold: option(CORE_TEXT.velocityThreshold),
    axisLockThreshold: option(CORE_TEXT.axisLockThreshold),
    animationDuration: option(CORE_TEXT.animationDuration),
    edgeResistance: option(CORE_TEXT.edgeResistance),
  };
  if (
    options.distanceThreshold <= 0 ||
    options.velocityThreshold <= 0 ||
    options.axisLockThreshold <= 0 ||
    options.animationDuration < 0 ||
    options.edgeResistance < 0 ||
    options.edgeResistance > 1
  ) {
    throw new RangeError(CORE_TEXT.thresholdsMustBePositiveDurationNonNegativeAndResistanceIn01);
  }
  const result = Object.freeze(options);

  return result;
}
/**
 * snapshotContext
 *
 * Copy viewport geometry and neighbor availability into an immutable context.
 * @param input The input argument.
 * @returns The validated immutable viewport dimensions and neighbor availability.
 */
function snapshotContext(input: unknown): GestureContext {
  const value = record(input, CORE_TEXT.gestureContext);
  const width = finiteNumber(value.width, CORE_TEXT.width);
  const height = finiteNumber(value.height, CORE_TEXT.height);
  if (width <= 0 || height <= 0 || width > Number.MAX_SAFE_INTEGER || height > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(CORE_TEXT.viewportDimensionsMustBeIn0NumberMAXSAFEINTEGER);
  }
  const neighbors = record(value.neighbors, CORE_TEXT.neighbors);
  /**
   * flag
   * @param direction The requested navigation direction.
   * @returns Whether the operation succeeded or the condition holds.
   */
  const flag = (direction: Direction): boolean => {
    const available = neighbors[direction];
    if (typeof available !== 'boolean') {
      throw new TypeError(CORE_MESSAGES.neighbor(direction));
    }

    return available;
  };
  const result = Object.freeze({
    width,
    height,
    neighbors: Object.freeze({
      up: flag(CORE_TEXT.up),
      down: flag(CORE_TEXT.down),
      left: flag(CORE_TEXT.left),
      right: flag(CORE_TEXT.right),
    }),
  });

  return result;
}
/**
 * pointerId
 *
 * Validate a nonnegative safe pointer identifier.
 * @param input The input argument.
 * @returns The computed numeric value.
 */
function pointerId(input: unknown): number {
  const id = finiteNumber(input, CORE_TEXT.pointerId);
  if (!Number.isSafeInteger(id) || id < 0) {
    throw new RangeError(CORE_TEXT.pointerIdMustBeANonNegativeSafeInteger);
  }

  return id;
}
/**
 * snapshotSample
 *
 * Validate and snapshot a timestamped pointer sample.
 * @param input The input argument.
 * @returns The validated immutable pointer sample.
 */
function snapshotSample(input: unknown): PointerSample {
  const value = record(input, CORE_TEXT.pointerSample);
  const id = pointerId(value.pointerId);
  const x = finiteNumber(value.x, CORE_TEXT.x);
  const y = finiteNumber(value.y, CORE_TEXT.y);
  const time = finiteNumber(value.time, CORE_TEXT.time);
  if (Math.abs(x) > Number.MAX_SAFE_INTEGER || Math.abs(y) > Number.MAX_SAFE_INTEGER || time < 0 || time > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(CORE_TEXT.coordinatesAndTimeMustFitTheSafeNumericRangeTimeMustBeNonNegative);
  }
  const result: PointerSample = { pointerId: id, x, y, time };

  return result;
}
/**
 * directionFor
 *
 * Convert a nonzero axis displacement into a supported navigation direction.
 * @param axis The axis argument.
 * @param delta The delta argument.
 * @returns The direction matching the displacement, or null for zero movement.
 */
function directionFor(axis: GestureAxis, delta: number): Direction | null {
  if (delta === 0) {
    const result = null;

    return result;
  }
  const negativeDirection = axis === CORE_TEXT.x ? CORE_TEXT.left : CORE_TEXT.up;
  const positiveDirection = axis === CORE_TEXT.x ? CORE_TEXT.right : CORE_TEXT.down;
  const direction = delta < 0 ? negativeDirection : positiveDirection;

  return direction;
}
/**
 * recentVelocity
 *
 * Estimate velocity over the bounded recent motion window.
 * @param samples The samples argument.
 * @returns The computed numeric value.
 */
function recentVelocity(samples: readonly MotionSample[]): number {
  const first = samples[0];
  const last = samples.at(-1);
  if (first === undefined || last === undefined || first.time === last.time) {
    const result = 0;

    return result;
  }
  const cutoff = last.time - VELOCITY_WINDOW_MS;
  let startTime = first.time;
  let startCoordinate = first.coordinate;
  const second = samples[1];
  if (first.time < cutoff && second !== undefined && second.time > cutoff) {
    const progress = (cutoff - first.time) / (second.time - first.time);
    startTime = cutoff;
    startCoordinate += (second.coordinate - first.coordinate) * progress;
  }
  const result = (last.coordinate - startCoordinate) / (last.time - startTime);

  return result;
}
/**
 * trackMotion
 *
 * Maintain bounded velocity history and reset its segment after a reversal or pause.
 * @param active The active argument.
 * @param axis The axis argument.
 * @param next The replacement value.
 */
function trackMotion(active: ActiveGesture, axis: GestureAxis, next: PointerSample): void {
  const stepSign = Math.sign(next[axis] - active.last[axis]);
  // A reversal or motion after a pause starts a fresh velocity segment.
  if (active.samples.length === 0 || (stepSign !== 0 && stepSign !== active.motionSign)) {
    active.samples = [{ coordinate: active.last[axis], time: active.last.time }];
  }
  active.motionSign = stepSign;
  const motion = { coordinate: next[axis], time: next.time };
  const previous = active.samples.at(PREVIOUS_MOTION_INDEX);
  const last = active.samples.at(-1);
  // Keep a time spaced history and the latest point, regardless of input rate.
  if (last?.time === next.time || (previous !== undefined && next.time - previous.time < SAMPLE_INTERVAL_MS)) {
    active.samples[active.samples.length - 1] = motion;
  } else {
    active.samples.push(motion);
  }
  const cutoff = next.time - VELOCITY_WINDOW_MS;
  // Retain one point before the window for interpolation at its boundary.
  while (active.samples.length > MIN_MOTION_SAMPLES && (active.samples[1]?.time ?? Infinity) <= cutoff) {
    active.samples.shift();
  }
  if (active.samples.length > MAX_SAMPLES) {
    active.samples.splice(1, active.samples.length - MAX_SAMPLES);
  }
}
/**
 * dragOffset
 *
 * Compute a bounded drag displacement with elastic resistance at unavailable edges.
 * @param axis The axis argument.
 * @param delta The delta argument.
 * @param context The context used by this operation.
 * @param resistance The resistance argument.
 * @returns The displacement limited to one viewport and reduced by boundary resistance.
 */
function dragOffset(axis: GestureAxis, delta: number, context: GestureContext, resistance: number): GestureOffset {
  const direction = directionFor(axis, delta);
  if (direction === null) return ZERO_OFFSET;

  const extent = axis === CORE_TEXT.x ? context.width : context.height;
  const magnitude = Math.abs(delta);
  const offset =
    Math.sign(delta) *
    (context.neighbors[direction] ? Math.min(magnitude, extent) : extent * resistance * (magnitude / (extent + magnitude)));
  const normalized = offset === 0 ? 0 : offset;
  const result = Object.freeze({ x: axis === CORE_TEXT.x ? normalized : 0, y: axis === CORE_TEXT.y ? normalized : 0 });

  return result;
}
/**
 * Functional pointer state machine operations; every instance owns its history and tokens.
 */
export interface GestureEngine {
  /**
   * getOptions
   *
   * Read the validated immutable gesture configuration.
   * @returns The validated gesture options.
   */
  readonly getOptions: () => Readonly<GestureOptions>;
  /**
   * getSnapshot
   *
   * Read a stable snapshot of the current state without exposing mutable internals.
   * @returns The current gesture state snapshot.
   */
  readonly getSnapshot: () => GestureSnapshot;
  /**
   * pointerDown
   *
   * Start tracking a primary pointer when the state machine is idle.
   * @param sample The sample argument.
   * @returns Whether the operation succeeded or the condition holds.
   */
  readonly pointerDown: (sample: PointerSample) => boolean;
  /**
   * pointerMove
   *
   * Advance the active gesture while preserving the locked axis.
   * @param sample The sample argument.
   * @returns Whether the operation succeeded or the condition holds.
   */
  readonly pointerMove: (sample: PointerSample) => boolean;
  /**
   * pointerUp
   *
   * Resolve a commit or rollback plan using distance and recent directional velocity.
   * @param sample The sample argument.
   * @returns The commit or rollback plan, or null when no settlement is needed.
   */
  readonly pointerUp: (sample: PointerSample) => GestureSettlement | null;
  /**
   * pointerCancel
   *
   * Cancel the active pointer and request a visual rollback when needed.
   * @param id The id argument.
   * @returns The rollback plan, or null when the pointer is inactive.
   */
  readonly pointerCancel: (id: number) => GestureSettlement | null;
  /**
   * lostPointerCapture
   *
   * Cancel a gesture whose pointer capture is no longer available.
   * @param id The id argument.
   * @returns The rollback plan, or null when the pointer is inactive.
   */
  readonly lostPointerCapture: (id: number) => GestureSettlement | null;
  /**
   * finishSettling
   *
   * Accept only the current settlement token and reset the gesture state.
   * @param settlement The settlement argument.
   * @returns Whether the operation succeeded or the condition holds.
   */
  readonly finishSettling: (settlement: GestureSettlement) => boolean;
  /**
   * updateContext
   *
   * Validate a replacement viewport and neighbor snapshot before resetting the gesture.
   * @param context The context used by this operation.
   */
  readonly updateContext: (context: GestureContext) => void;
  /**
   * destroy
   *
   * Release owned resources once and settle pending work without leaving stale callbacks.
   */
  readonly destroy: () => void;
}
/**
 * createGestureEngine
 *
 * Create a DOM independent gesture state machine with isolated closure state.
 * @param context Positive viewport dimensions and currently available navigation neighbors.
 * @param options Validated container, grid, rendering strategy, and optional lifecycle callbacks.
 * @returns Independent operations that can be called without binding a receiver.
 */
export function createGestureEngine(context: GestureContext, options?: Partial<GestureOptions>): GestureEngine {
  let stateContext: GestureContext;
  let stateActive: ActiveGesture | null = null;
  let stateSettlement: GestureSettlement | null = null;
  let stateAxis: GestureAxis | null = null;
  let stateOffset: GestureOffset = ZERO_OFFSET;
  let stateDestroyed = false;
  /**
   * getOptions
   *
   * Read the validated immutable gesture configuration.
   * @returns The validated gesture options.
   */
  function getOptions(): Readonly<GestureOptions> {
    return stateOptions;
  }
  /**
   * getSnapshot
   *
   * Read a stable snapshot of the current state without exposing mutable internals.
   * @returns The current gesture state snapshot.
   */
  function getSnapshot(): GestureSnapshot {
    const result = Object.freeze({
      state: readState(),
      axis: stateAxis,
      pointerId: stateActive?.start.pointerId ?? null,
      offset: stateOffset,
      destroyed: stateDestroyed,
    });

    return result;
  }
  /**
   * pointerDown
   *
   * Start tracking a primary pointer when the state machine is idle.
   * @param sample The sample argument.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function pointerDown(sample: PointerSample): boolean {
    if (stateDestroyed || readState() !== CORE_TEXT.idle) {
      const result = false;

      return result;
    }
    const start = snapshotSample(sample);
    stateActive = { start, last: start, motionSign: 0, samples: [] };
    const result = true;

    return result;
  }
  /**
   * pointerMove
   *
   * Advance the active gesture while preserving the locked axis.
   * @param sample The sample argument.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function pointerMove(sample: PointerSample): boolean {
    const active = stateActive;
    if (stateDestroyed || active === null) {
      const result = false;

      return result;
    }
    const next = snapshotSample(sample);
    if (next.pointerId !== active.start.pointerId || next.time < active.last.time) {
      const result = false;

      return result;
    }
    advance(active, next);
    const result = true;

    return result;
  }
  /**
   * pointerUp
   *
   * Resolve a commit or rollback plan using distance and recent directional velocity.
   * @param sample The sample argument.
   * @returns The commit or rollback plan, or null when no settlement is needed.
   */
  function pointerUp(sample: PointerSample): GestureSettlement | null {
    const active = stateActive;
    if (stateDestroyed || active === null) {
      const result = null;

      return result;
    }
    const next = snapshotSample(sample);
    if (next.pointerId !== active.start.pointerId || next.time < active.last.time) {
      const result = null;

      return result;
    }
    advance(active, next);
    const axis = stateAxis;
    if (axis === null) {
      reset();
      const result = null;

      return result;
    }
    const delta = next[axis] - active.start[axis];
    const direction = directionFor(axis, delta);
    const velocity = recentVelocity(active.samples);
    const fast = Math.abs(velocity) >= stateOptions.velocityThreshold;
    const reversing = fast && Math.sign(velocity) !== Math.sign(delta);
    const commit =
      direction !== null && stateContext.neighbors[direction] && !reversing && (Math.abs(delta) >= stateOptions.distanceThreshold || fast);
    const result = settle(commit ? direction : null);

    return result;
  }
  /**
   * pointerCancel
   *
   * Cancel the active pointer and request a visual rollback when needed.
   * @param id The id argument.
   * @returns The rollback plan, or null when the pointer is inactive.
   */
  function pointerCancel(id: number): GestureSettlement | null {
    const active = stateActive;
    if (stateDestroyed || active === null) {
      const result = null;

      return result;
    }
    if (pointerId(id) !== active.start.pointerId) {
      const result = null;

      return result;
    }
    if (stateAxis === null) {
      reset();
      const result = null;

      return result;
    }
    const result = settle(null);

    return result;
  }
  /**
   * lostPointerCapture
   *
   * Cancel a gesture whose pointer capture is no longer available.
   * @param id The id argument.
   * @returns The rollback plan, or null when the pointer is inactive.
   */
  function lostPointerCapture(id: number): GestureSettlement | null {
    const result = pointerCancel(id);

    return result;
  }
  /**
   * finishSettling
   *
   * Accept only the current settlement token and reset the gesture state.
   * @param settlement The settlement argument.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function finishSettling(settlement: GestureSettlement): boolean {
    if (stateSettlement === null || stateSettlement !== settlement) {
      const result = false;

      return result;
    }
    reset();
    const result = true;

    return result;
  }
  /**
   * updateContext
   *
   * Validate a replacement viewport and neighbor snapshot before resetting the gesture.
   * @param context The context used by this operation.
   */
  function updateContext(context: GestureContext): void {
    if (stateDestroyed) return;

    const next = snapshotContext(context);
    stateContext = next;
    reset();
  }
  /**
   * destroy
   *
   * Release owned resources once and settle pending work without leaving stale callbacks.
   */
  function destroy(): void {
    if (stateDestroyed) return;

    stateDestroyed = true;
    reset();
  }
  /**
   * advance
   *
   * Advance pointer history and lock the dominant axis after the dead zone.
   * @param active The active argument.
   * @param next The replacement value.
   */
  function advance(active: ActiveGesture, next: PointerSample): void {
    const dx = next.x - active.start.x;
    const dy = next.y - active.start.y;
    if (stateAxis === null && Math.max(Math.abs(dx), Math.abs(dy)) >= stateOptions.axisLockThreshold && Math.abs(dx) !== Math.abs(dy)) {
      stateAxis = Math.abs(dx) > Math.abs(dy) ? CORE_TEXT.x : CORE_TEXT.y;
    }
    const axis = stateAxis;
    if (axis !== null) {
      trackMotion(active, axis, next);
      const delta = axis === CORE_TEXT.x ? dx : dy;
      stateOffset = dragOffset(axis, delta, stateContext, stateOptions.edgeResistance);
    }
    active.last = next;
  }
  /**
   * settle
   *
   * Create an immutable settlement token and relinquish the active pointer.
   * @param direction The requested navigation direction.
   * @returns The immutable animation plan for committing a neighbor or rolling back.
   */
  function settle(direction: Direction | null): GestureSettlement {
    let to = ZERO_OFFSET;
    if (direction !== null) {
      const { width, height } = stateContext;
      to = Object.freeze({
        x: direction === CORE_TEXT.left ? -width : direction === CORE_TEXT.right ? width : 0,
        y: direction === CORE_TEXT.up ? -height : direction === CORE_TEXT.down ? height : 0,
      });
    }
    const plan = Object.freeze({ direction, from: stateOffset, to, duration: stateOptions.animationDuration });
    stateActive = null;
    stateSettlement = plan;

    return plan;
  }
  /**
   * reset
   *
   * Cancel pending motion and restore the viewport origin.
   */
  function reset(): void {
    stateActive = null;
    stateSettlement = null;
    stateAxis = null;
    stateOffset = ZERO_OFFSET;
  }
  /**
   * readState
   *
   * Derive the gesture phase from the active pointer and settlement token.
   * @returns The current gesture phase.
   */
  function readState(): GestureState {
    if (stateSettlement !== null) {
      const result = CORE_TEXT.settling;

      return result;
    }
    if (stateActive === null) {
      const result = CORE_TEXT.idle;

      return result;
    }
    const result = stateAxis === null ? CORE_TEXT.tracking : CORE_TEXT.dragging;

    return result;
  }
  stateContext = snapshotContext(context);
  const stateOptions = resolveOptions(options);
  const api: GestureEngine = {
    getOptions,
    getSnapshot,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    lostPointerCapture,
    finishSettling,
    updateContext,
    destroy,
  };

  return api;
}
