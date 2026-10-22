import { CORE_TEXT, CORE_MESSAGES } from './config';
import { DEFAULT_GESTURE_OPTIONS, ZERO_OFFSET, VELOCITY_WINDOW_MS, SAMPLE_INTERVAL_MS, MAX_SAMPLES, MIN_MOTION_SAMPLES, PREVIOUS_MOTION_INDEX } from './config';
import type { Direction } from './navigation';
/**
 * Validated gesture tuning values; distances use CSS pixels and times use milliseconds.
 */
export interface GestureOptions {
  /** Positive finite commit distance in CSS pixels; defaults to DEFAULT_GESTURE_OPTIONS.distanceThreshold. */
  readonly distanceThreshold: number;
  /** Positive finite flick velocity in CSS pixels per millisecond; defaults to DEFAULT_GESTURE_OPTIONS.velocityThreshold. */
  readonly velocityThreshold: number;
  /** Positive finite dead-zone distance in CSS pixels; defaults to DEFAULT_GESTURE_OPTIONS.axisLockThreshold. */
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
/** An immutable axis-aligned displacement measured in CSS pixels. */
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
/** An identity-bearing animation plan for committing a neighbor or rolling back. */
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
 * Validate an object-shaped runtime input before reading its fields.
 */
function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(CORE_MESSAGES.object(label));
  }
  const result = value as Record<string, unknown>;

  return result;

}
/**
 * Validate a finite numeric input without coercion.
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
 * Merge gesture overrides with central defaults and validate every supported option.
 */
function resolveOptions(input: unknown): Readonly<GestureOptions> {
  const overrides = input === undefined ? {} : record(input, CORE_TEXT.gestureOptions);
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(DEFAULT_GESTURE_OPTIONS, key)) {
      throw new TypeError(CORE_MESSAGES.option(key));
    }
  }
  const option = (key: keyof GestureOptions): number => finiteNumber(Object.hasOwn(overrides, key) ? overrides[key] : DEFAULT_GESTURE_OPTIONS[key], key);
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
 * Copy viewport geometry and neighbor availability into an immutable context.
 */
function snapshotContext(input: unknown): GestureContext {
  const value = record(input, CORE_TEXT.gestureContext);
  const width = finiteNumber(value.width, CORE_TEXT.width);
  const height = finiteNumber(value.height, CORE_TEXT.height);
  if (width <= 0 || height <= 0 || width > Number.MAX_SAFE_INTEGER || height > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(CORE_TEXT.viewportDimensionsMustBeIn0NumberMAXSAFEINTEGER);
  }
  const neighbors = record(value.neighbors, CORE_TEXT.neighbors);
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
 * Validate a nonnegative safe pointer identifier.
 */
function pointerId(input: unknown): number {
  const id = finiteNumber(input, CORE_TEXT.pointerId);
  if (!Number.isSafeInteger(id) || id < 0) {
    throw new RangeError(CORE_TEXT.pointerIdMustBeANonNegativeSafeInteger);
  }

  return id;

}
/**
 * Validate and snapshot a timestamped pointer sample.
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
 * Convert a nonzero axis displacement into a supported navigation direction.
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
 * Estimate velocity over the bounded recent motion window.
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
 * Maintain bounded velocity history and reset its segment after a reversal or pause.
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
  // Keep a time-spaced history and the latest point, regardless of input rate.
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
 * Compute a bounded drag displacement with elastic resistance at unavailable edges.
 */
function dragOffset(axis: GestureAxis, delta: number, context: GestureContext, resistance: number): GestureOffset {
  const direction = directionFor(axis, delta);
  if (direction === null)
    return ZERO_OFFSET;

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
  /** Read the validated immutable gesture configuration. */
  readonly getOptions: () => Readonly<GestureOptions>;
  /** Read a stable snapshot of the current state without exposing mutable internals. */
  readonly getSnapshot: () => GestureSnapshot;
  /** Start tracking a primary pointer when the state machine is idle. */
  readonly pointerDown: (sample: PointerSample) => boolean;
  /** Advance the active gesture while preserving the locked axis. */
  readonly pointerMove: (sample: PointerSample) => boolean;
  /** Resolve a commit or rollback plan using distance and recent directional velocity. */
  readonly pointerUp: (sample: PointerSample) => GestureSettlement | null;
  /** Cancel the active pointer and request a visual rollback when needed. */
  readonly pointerCancel: (id: number) => GestureSettlement | null;
  /** Cancel a gesture whose pointer capture is no longer available. */
  readonly lostPointerCapture: (id: number) => GestureSettlement | null;
  /** Accept only the current settlement token and reset the gesture state. */
  readonly finishSettling: (settlement: GestureSettlement) => boolean;
  /** Validate a replacement viewport and neighbor snapshot before resetting the gesture. */
  readonly updateContext: (context: GestureContext) => void;
  /** Release owned resources once and settle pending work without leaving stale callbacks. */
  readonly destroy: () => void;
}
/**
 * Create a DOM-independent gesture state machine with isolated closure state.
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
   * Read the validated immutable gesture configuration.
   */
  function getOptions(): Readonly<GestureOptions> {

    return stateOptions;

  }
  /**
   * Read a stable snapshot of the current state without exposing mutable internals.
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
   * Start tracking a primary pointer when the state machine is idle.
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
   * Advance the active gesture while preserving the locked axis.
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
   * Resolve a commit or rollback plan using distance and recent directional velocity.
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
   * Cancel the active pointer and request a visual rollback when needed.
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
   * Cancel a gesture whose pointer capture is no longer available.
   */
  function lostPointerCapture(id: number): GestureSettlement | null {
    const result = pointerCancel(id);

    return result;

  }
  /**
   * Accept only the current settlement token and reset the gesture state.
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
   * Validate a replacement viewport and neighbor snapshot before resetting the gesture.
   */
  function updateContext(context: GestureContext): void {
    if (stateDestroyed)
      return;

    const next = snapshotContext(context);
    stateContext = next;
    reset();
  }
  /**
   * Release owned resources once and settle pending work without leaving stale callbacks.
   */
  function destroy(): void {
    if (stateDestroyed)
      return;

    stateDestroyed = true;
    reset();
  }
  /**
   * Advance pointer history and lock the dominant axis after the dead zone.
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
   * Create an immutable settlement token and relinquish the active pointer.
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
   * Cancel pending motion and restore the viewport origin.
   */
  function reset(): void {
    stateActive = null;
    stateSettlement = null;
    stateAxis = null;
    stateOffset = ZERO_OFFSET;
  }
  /**
   * Derive the gesture phase from the active pointer and settlement token.
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
