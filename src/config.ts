import type { GestureOptions, GestureOffset } from './gesture';
/** Immutable gesture defaults: CSS pixels, CSS pixels per millisecond, milliseconds, and a resistance ratio. */
export const DEFAULT_GESTURE_OPTIONS: Readonly<GestureOptions> = Object.freeze({
  distanceThreshold: 80,
  velocityThreshold: 0.5,
  axisLockThreshold: 8,
  animationDuration: 300,
  edgeResistance: 0.35,
});
/** Quiet period in milliseconds separating wheel bursts, including trackpad inertia. */
export const WHEEL_IDLE_MS = 160;
/** Velocity history duration in milliseconds. */
export const VELOCITY_WINDOW_MS = 80;
/** Minimum spacing between stored velocity samples, in milliseconds. */
export const SAMPLE_INTERVAL_MS = 2;
/** Maximum number of retained velocity samples. */
export const MAX_SAMPLES = 64;
/** Minimum motion samples needed to estimate a segment. */
export const MIN_MOTION_SAMPLES = 2;
/** Array offset of the sample preceding the most recently stored motion sample. */
export const PREVIOUS_MOTION_INDEX = -2;
/** Cubic ease-out exponent. */
export const EASING_POWER = 3;
/** Shared immutable origin; never mutated by an engine instance. */
export const ZERO_OFFSET: GestureOffset = Object.freeze({ x: 0, y: 0 });
/** Supported adjacent navigation commands, in renderer mounting order. */
export const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right'] as const);
/** Centralized protocol tokens, DOM attributes, styles, labels, and validation messages. */
export const CORE_TEXT = Object.freeze({
  grid: 'Grid',
  gridRow: 'Grid row',
  row: 'row',
  col: 'col',
  positionMustHaveNumericRowAndColFields: 'Position must have numeric row and col fields',
  positionCoordinatesMustBeNonNegativeSafeIntegers: 'Position coordinates must be non-negative safe integers',
  positionIsOutsideTheGrid: 'Position is outside the grid',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  directionMustBeUpDownLeftOrRight: 'Direction must be up, down, left, or right',
  gridMustContainTheSelectedRow: 'Grid must contain the selected row',
  gestureOptions: 'Gesture options',
  distanceThreshold: 'distanceThreshold',
  velocityThreshold: 'velocityThreshold',
  axisLockThreshold: 'axisLockThreshold',
  animationDuration: 'animationDuration',
  edgeResistance: 'edgeResistance',
  thresholdsMustBePositiveDurationNonNegativeAndResistanceIn01:
    'Thresholds must be positive, duration non-negative, and resistance in [0, 1]',
  gestureContext: 'Gesture context',
  width: 'width',
  height: 'height',
  viewportDimensionsMustBeIn0NumberMAXSAFEINTEGER: 'Viewport dimensions must be in (0, Number.MAX_SAFE_INTEGER]',
  neighbors: 'neighbors',
  pointerId: 'pointerId',
  pointerIdMustBeANonNegativeSafeInteger: 'pointerId must be a non-negative safe integer',
  pointerSample: 'Pointer sample',
  x: 'x',
  y: 'y',
  time: 'time',
  coordinatesAndTimeMustFitTheSafeNumericRangeTimeMustBeNonNegative:
    'Coordinates and time must fit the safe numeric range; time must be non-negative',
  idle: 'idle',
  settling: 'settling',
  tracking: 'tracking',
  dragging: 'dragging',
  position: 'Position',
  positionRequiresNumericRowCol: 'Position requires numeric row/col',
  positionMustUseNonNegativeSafeIntegers: 'Position must use non-negative safe integers',
  current: 'current',
  navigationSourceReturnedANonAdjacentNeighbor: 'Navigation source returned a non-adjacent neighbor',
  invalidContainerGeometry: 'Invalid container geometry',
  offset: 'Offset',
  offsetRequiresNumericXY: 'Offset requires numeric x/y',
  offsetMustBeFiniteAxisAlignedAndWithinOneViewport: 'Offset must be finite, axis-aligned, and within one viewport',
  animationPlan: 'Animation plan',
  invalidAnimationDirection: 'Invalid animation direction',
  animationDurationMustBeNumeric: 'Animation duration must be numeric',
  animationDurationMustBeFiniteAndNonNegative: 'Animation duration must be finite and non-negative',
  animationTargetMustMatchItsDirectionAndViewport: 'Animation target must match its direction and viewport',
  mountedCellHandle: 'Mounted cell handle',
  adapterHandleRequiresUpdateAndUnmount: 'Adapter handle requires update and unmount',
  animationValidationFailed: 'Animation validation failed',
  cannotSyncDuringAdapterLifecycle: 'Cannot sync during adapter lifecycle',
  empty: '',
  rendererCleanupFailed: 'Renderer cleanup failed',
  div: 'div',
  positionAbsoluteInset0OverflowHiddenBoxSizingBorderBoxWillChangeTransform:
    'position:absolute;inset:0;overflow:hidden;box-sizing:border-box;will-change:transform;',
  ariaHidden: 'aria-hidden',
  false: 'false',
  true: 'true',
  hidden: 'hidden',
  rendererOperationAndCleanupFailed: 'Renderer operation and cleanup failed',
  rendererOptions: 'Renderer options',
  rendererContainerMustBeAnHTMLElement: 'Renderer container must be an HTMLElement',
  navigationSource: 'Navigation source',
  invalidNavigationSource: 'Invalid navigation source',
  cellAdapter: 'Cell adapter',
  adapterRequiresMount: 'Adapter requires mount',
  onResizeMustBeAFunction: 'onResize must be a function',
  dataTikitakiViewport: 'data-tikitaki-viewport',
  containerAlreadyHasARenderer: 'Container already has a renderer',
  dOMRendererRequiresResizeObserverAndAnActiveDocument: 'DOMRenderer requires ResizeObserver and an active document',
  static: 'static',
  positionStyle: 'position',
  relative: 'relative',
  overflow: 'overflow',
  touchAction: 'touch-action',
  none: 'none',
  positionAbsoluteInset0OverflowHiddenIsolationIsolate: 'position:absolute;inset:0;overflow:hidden;isolation:isolate;',
  renderCellMustBeAFunction: 'renderCell must be a function',
  renderCellMustReturnAnHTMLElement: 'renderCell must return an HTMLElement',
  renderCellMustReturnAnUnownedElement: 'renderCell must return an unowned element',
  swipeEngineOperationFailed: 'SwipeEngine operation failed',
  name: 'name',
  notFoundError: 'NotFoundError',
  swipeEngineOptions: 'SwipeEngine options',
  provideExactlyOneOfAdapterOrRenderCell: 'Provide exactly one of adapter or renderCell',
  mouse: 'mouse',
  touch: 'touch',
  pen: 'pen',
  cannotUpdateGridDuringCellLifecycle: 'Cannot update grid during cell lifecycle',
  dataTikitakiEngine: 'data-tikitaki-engine',
  swipeEngineCleanupFailed: 'SwipeEngine cleanup failed',
  scopeDataTikitakiViewport: ':scope > [data-tikitaki-viewport]',
  swipeEngineOperationAndCleanupFailed: 'SwipeEngine operation and cleanup failed',
  containerMustBeAnHTMLElement: 'Container must be an HTMLElement',
  anActiveDocumentWithPointerCaptureIsRequired: 'An active document with pointer capture is required',
  onPositionChange: 'onPositionChange',
  onError: 'onError',
  error: 'error',
  wheel: 'wheel',
  pointerdown: 'pointerdown',
  pointermove: 'pointermove',
  pointerup: 'pointerup',
  pointercancel: 'pointercancel',
  lostpointercapture: 'lostpointercapture',
  click: 'click',
  dragstart: 'dragstart',
  selectstart: 'selectstart',
});
/** Browser pointer device kinds accepted by the controller. */
export const POINTER_TYPES: readonly string[] = Object.freeze(['mouse', 'touch', 'pen']);

/** Default navigation coordinates; successful vertical transitions still follow the strict grid rules. */
export const ORIGIN_POSITION = Object.freeze({ row: 0, col: 0 });

/** Dynamic validation messages are centralized with static ownership and protocol messages. */
export const CORE_MESSAGES = Object.freeze({
  object: (label: string) => `${label} must be an object`,
  array: (label: string) => `${label} must be an array`,
  nonempty: (label: string) => `${label} must not be empty`,
  dense: (label: string) => `${label} must not contain holes`,
  numeric: (label: string) => `${label} must be a number`,
  finite: (label: string) => `${label} must be finite`,
  option: (key: string) => `Unknown gesture option: ${key}`,
  neighbor: (direction: string) => `neighbors.${direction} must be a boolean`,
  callback: (key: string) => `${key} must be a function`,
});

/** Format a renderer offset as a compositor-friendly CSS transform. */
export function translateOffset(x: number, y: number): string {
  const transform = `translate3d(${String(x)}px, ${String(y)}px, 0px)`;

  return transform;
}
