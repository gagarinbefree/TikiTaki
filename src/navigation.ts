import { CORE_TEXT, CORE_MESSAGES, ORIGIN_POSITION } from './config';
/**
 * Immutable zero based ragged grid coordinates.
 */
export interface Position {
  readonly row: number;
  readonly col: number;
}
/** Options for vertical navigation through one shared column. */
export interface NavigationOptions {
  readonly primaryColumn?: number;
  /** Optional home row used for the initial cell and explicit returns. */
  readonly primaryRow?: number;
  /**
   * rowStartColumn. Read the logical column of the first item in a row.
   * @param row The zero based row index in the replacement grid.
   * @returns The nonnegative logical column where this row begins.
   */
  readonly rowStartColumn?: (row: number) => number;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Grid<T> = readonly (readonly T[])[];
/**
 * assertNonEmptyDenseArray
 *
 * Validate that an input is a nonempty array without missing indices.
 * @param value The value to process.
 * @param label The label used in validation messages.
 */
function assertNonEmptyDenseArray(value: unknown, label: string): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(CORE_MESSAGES.array(label));
  }
  if (value.length === 0) {
    throw new RangeError(CORE_MESSAGES.nonempty(label));
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new TypeError(CORE_MESSAGES.dense(label));
    }
  }
}
/**
 * snapshotGrid
 *
 * Copy and freeze grid structure while preserving item identity.
 * @param grid Grid rows and their cell data.
 * @returns The validated immutable grid snapshot.
 */
function snapshotGrid<T>(grid: Grid<T>): Grid<T> {
  assertNonEmptyDenseArray(grid, CORE_TEXT.grid);
  const result = Object.freeze(
    grid.map((row) => {
      assertNonEmptyDenseArray(row, CORE_TEXT.gridRow);
      const result = Object.freeze([...row]);

      return result;
    }),
  );

  return result;
}
/**
 * snapshotRowStarts. Validate and freeze the logical start of every row.
 * @param grid The validated dense cell arrays.
 * @param primaryColumn The shared target column for vertical navigation.
 * @param readStart The optional function providing each row start.
 * @returns The immutable logical row starts for this grid snapshot.
 */
function snapshotRowStarts<T>(grid: Grid<T>, primaryColumn: number, readStart: NavigationOptions['rowStartColumn']): readonly number[] {
  const result = Object.freeze(
    grid.map((row, index) => {
      const start: unknown = readStart?.(index) ?? 0;
      if (typeof start !== 'number' || !Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(start + row.length - 1)) {
        throw new RangeError(CORE_TEXT.invalidRowStartColumn);
      }
      if (primaryColumn < start || primaryColumn >= start + row.length) {
        throw new RangeError(CORE_TEXT.primaryColumnMissing);
      }

      return start;
    }),
  );

  return result;
}
/**
 * checkedPosition
 *
 * Validate coordinates and return an immutable position snapshot.
 * @param grid Grid rows and their cell data.
 * @param position Zero based logical cell coordinates.
 * @param starts The logical start column of each row.
 * @returns The resulting cell coordinates.
 */
function checkedPosition<T>(grid: Grid<T>, position: unknown, starts: readonly number[]): Position {
  if (
    typeof position !== 'object' ||
    position === null ||
    !(CORE_TEXT.row in position) ||
    !(CORE_TEXT.col in position) ||
    typeof position.row !== 'number' ||
    typeof position.col !== 'number'
  ) {
    throw new TypeError(CORE_TEXT.positionMustHaveNumericRowAndColFields);
  }
  if (!Number.isSafeInteger(position.row) || !Number.isSafeInteger(position.col) || position.row < 0 || position.col < 0) {
    throw new RangeError(CORE_TEXT.positionCoordinatesMustBeNonNegativeSafeIntegers);
  }
  const row = grid[position.row];
  const start = starts[position.row] ?? 0;
  if (row === undefined || position.col < start || position.col >= start + row.length) {
    throw new RangeError(CORE_TEXT.positionIsOutsideTheGrid);
  }
  const result = Object.freeze({ row: position.row, col: position.col });

  return result;
}
/**
 * findNeighbor. Resolve adjacent cells using the primary column for vertical movement.
 * @param grid Grid rows and their cell data.
 * @param position Zero based cell coordinates.
 * @param direction The requested navigation direction.
 * @param primaryColumn The target column for vertical movement.
 * @param starts The logical start column of each row.
 * @returns The neighboring cell coordinates, or null when no neighbor exists.
 */
function findNeighbor<T>(
  grid: Grid<T>,
  position: Position,
  direction: Direction,
  primaryColumn: number,
  starts: readonly number[],
): Position | null {
  const { row, col } = position;
  let target: Position;
  switch (direction) {
    case CORE_TEXT.up:
      target = { row: row + 1, col: primaryColumn };
      break;
    case CORE_TEXT.down:
      target = { row: row - 1, col: primaryColumn };
      break;
    case CORE_TEXT.left:
      target = { row, col: col + 1 };
      break;
    case CORE_TEXT.right:
      target = { row, col: col - 1 };
      break;
    default:
      throw new TypeError(CORE_TEXT.directionMustBeUpDownLeftOrRight);
  }
  const targetRow = grid[target.row];
  const start = starts[target.row] ?? 0;
  if (targetRow === undefined || target.col < start || target.col >= start + targetRow.length) {
    const result = null;

    return result;
  }
  const result = Object.freeze(target);

  return result;
}
/**
 * Functional synchronous navigation operations; methods do not depend on a receiver.
 */
export interface NavigationModel<T> {
  /**
   * getPosition
   *
   * Read the immutable last committed grid position.
   * @returns The resulting cell coordinates.
   */
  readonly getPosition: () => Position;
  /**
   * getPrimaryPosition. Read the configured home cell.
   * @returns The immutable primary row and column coordinates.
   */
  readonly getPrimaryPosition: () => Position;
  /**
   * getItem
   *
   * Read an item after validating its coordinates against the owned grid snapshot.
   * @param position Zero based cell coordinates.
   * @returns The item at the validated grid coordinates.
   */
  readonly getItem: (position: Position) => T;
  /**
   * getNeighbor
   *
   * Resolve one adjacent position without changing navigation state.
   * @param direction The requested navigation direction.
   * @returns The neighboring cell coordinates, or null when no neighbor exists.
   */
  readonly getNeighbor: (direction: Direction) => Position | null;
  /**
   * navigate
   *
   * Request one neighboring transition without queuing conflicting commands.
   * @param direction The requested navigation direction.
   * @returns Whether the operation succeeded or the condition holds.
   */
  readonly navigate: (direction: Direction) => boolean;
  /**
   * goTo
   *
   * Commit a valid target position without traversing intermediate cells.
   * @param position Zero based cell coordinates.
   * @returns Whether the operation succeeded or the condition holds.
   */
  readonly goTo: (position: Position) => boolean;
  /**
   * updateGrid
   *
   * Validate and replace the grid, clamp coordinates when necessary, and synchronize owned resources.
   * @param grid Grid rows and their cell data.
   */
  readonly updateGrid: (grid: Grid<T>) => void;
}
/**
 * createNavigationModel
 *
 * Create independent ragged grid operations backed by a private grid snapshot.
 * @param grid Nonempty ragged grid; structure is copied while item identity is retained.
 * @param initialPosition Validated initial coordinates; defaults to the configured origin.
 * @param options The optional shared primary column with zero as the default.
 * @returns Independent operations that can be called without binding a receiver.
 */
export function createNavigationModel<T>(grid: Grid<T>, initialPosition?: Position, options: NavigationOptions = {}): NavigationModel<T> {
  const input: unknown = options;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TypeError(CORE_TEXT.invalidNavigationOptions);
  }
  const candidate: unknown = options.primaryColumn ?? 0;
  if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
    throw new RangeError(CORE_TEXT.invalidPrimaryColumn);
  }
  const readStart = options.rowStartColumn;
  if (readStart !== undefined && typeof readStart !== 'function') {
    throw new TypeError(CORE_TEXT.invalidRowStartReader);
  }
  const primaryColumn = candidate;
  const primaryRow: unknown = options.primaryRow ?? 0;
  if (typeof primaryRow !== 'number' || !Number.isSafeInteger(primaryRow) || primaryRow < 0) {
    throw new RangeError(CORE_TEXT.invalidPrimaryRow);
  }
  const primaryPosition = Object.freeze({ row: primaryRow, col: primaryColumn });
  let stateGrid: Grid<T>;
  let stateStarts: readonly number[];
  let statePosition: Position;
  /**
   * getPrimaryPosition. Read the configured home cell without moving the selection.
   * @returns The immutable primary row and column coordinates.
   */
  function getPrimaryPosition(): Position {
    return primaryPosition;
  }
  /**
   * getPosition. Read the immutable last committed grid position.
   * @returns The current cell coordinates.
   */
  function getPosition(): Position {
    return statePosition;
  }
  /**
   * getItem
   *
   * Read an item after validating its coordinates against the owned grid snapshot.
   * @param position Zero based cell coordinates.
   * @returns The item at the validated grid coordinates.
   */
  function getItem(position: Position): T {
    const checked = checkedPosition(stateGrid, position, stateStarts);
    const result = stateGrid[checked.row]?.[checked.col - (stateStarts[checked.row] ?? 0)] as T;

    return result;
  }
  /**
   * getNeighbor
   *
   * Resolve one adjacent position without changing navigation state.
   * @param direction The requested navigation direction.
   * @returns The neighboring cell coordinates, or null when no neighbor exists.
   */
  function getNeighbor(direction: Direction): Position | null {
    const result = findNeighbor(stateGrid, statePosition, direction, primaryColumn, stateStarts);

    return result;
  }
  /**
   * navigate
   *
   * Request one neighboring transition without queuing conflicting commands.
   * @param direction The requested navigation direction.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function navigate(direction: Direction): boolean {
    const target = getNeighbor(direction);
    if (target === null) {
      const result = false;

      return result;
    }
    statePosition = target;
    const result = true;

    return result;
  }
  /**
   * goTo
   *
   * Commit a valid target position without traversing intermediate cells.
   * @param position Zero based cell coordinates.
   * @returns Whether the operation succeeded or the condition holds.
   */
  function goTo(position: Position): boolean {
    const target = checkedPosition(stateGrid, position, stateStarts);
    if (target.row === statePosition.row && target.col === statePosition.col) {
      const result = false;

      return result;
    }
    statePosition = target;
    const result = true;

    return result;
  }
  /**
   * updateGrid
   *
   * Validate and replace the grid, clamp coordinates when necessary, and synchronize owned resources.
   * @param grid Grid rows and their cell data.
   */
  function updateGrid(grid: Grid<T>): void {
    const nextGrid = snapshotGrid(grid);
    const nextStarts = snapshotRowStarts(nextGrid, primaryColumn, readStart);
    checkedPosition(nextGrid, primaryPosition, nextStarts);
    const row = Math.min(statePosition.row, nextGrid.length - 1);
    const nextRow = nextGrid[row];
    if (nextRow === undefined) {
      throw new RangeError(CORE_TEXT.gridMustContainTheSelectedRow);
    }
    const start = nextStarts[row] ?? 0;
    const col = Math.max(start, Math.min(statePosition.col, start + nextRow.length - 1));
    stateGrid = nextGrid;
    stateStarts = nextStarts;
    statePosition = Object.freeze({ row, col });
  }
  stateGrid = snapshotGrid(grid);
  stateStarts = snapshotRowStarts(stateGrid, primaryColumn, readStart);
  checkedPosition(stateGrid, primaryPosition, stateStarts);
  const supplied: unknown = initialPosition;
  if (supplied === null) throw new TypeError(CORE_TEXT.positionMustHaveNumericRowAndColFields);
  statePosition = checkedPosition(
    stateGrid,
    initialPosition ?? (options.primaryRow === undefined ? ORIGIN_POSITION : primaryPosition),
    stateStarts,
  );
  const api: NavigationModel<T> = { getPosition, getPrimaryPosition, getItem, getNeighbor, navigate, goTo, updateGrid };

  return api;
}
