import { CORE_TEXT, CORE_MESSAGES, ORIGIN_POSITION } from './config';
/**
 * Immutable zero-based ragged-grid coordinates.
 */
export interface Position {
  readonly row: number;
  readonly col: number;
}
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Grid<T> = readonly (readonly T[])[];
/**
 * Validate that an input is a nonempty array without missing indices.
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
 * Copy and freeze grid structure while preserving item identity.
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
 * Validate coordinates and return an immutable position snapshot.
 */
function checkedPosition<T>(grid: Grid<T>, position: unknown): Position {
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
  if (row === undefined || position.col >= row.length) {
    throw new RangeError(CORE_TEXT.positionIsOutsideTheGrid);
  }
  const result = Object.freeze({ row: position.row, col: position.col });

  return result;
}
/**
 * Apply strict ragged-grid navigation, resetting the column only on successful vertical movement.
 */
function findNeighbor<T>(grid: Grid<T>, position: Position, direction: Direction): Position | null {
  const { row, col } = position;
  let target: Position;
  switch (direction) {
    case CORE_TEXT.up:
      target = { row: row + 1, col: 0 };
      break;
    case CORE_TEXT.down:
      target = { row: row - 1, col: 0 };
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
  if (targetRow === undefined || target.col < 0 || target.col >= targetRow.length) {
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
  /** Read the immutable last committed grid position. */
  readonly getPosition: () => Position;
  /** Read an item after validating its coordinates against the owned grid snapshot. */
  readonly getItem: (position: Position) => T;
  /** Resolve one adjacent position without changing navigation state. */
  readonly getNeighbor: (direction: Direction) => Position | null;
  /** Request one neighboring transition without queuing conflicting commands. */
  readonly navigate: (direction: Direction) => boolean;
  /** Commit a valid target position without traversing intermediate cells. */
  readonly goTo: (position: Position) => boolean;
  /** Validate and replace the grid, clamp coordinates when necessary, and synchronize owned resources. */
  readonly updateGrid: (grid: Grid<T>) => void;
}
/**
 * Create independent ragged-grid operations backed by a private grid snapshot.
 * @param grid Nonempty ragged grid; structure is copied while item identity is retained.
 * @param initialPosition Validated initial coordinates; defaults to the configured origin.
 * @returns Independent operations that can be called without binding a receiver.
 */
export function createNavigationModel<T>(grid: Grid<T>, initialPosition: Position = ORIGIN_POSITION): NavigationModel<T> {
  let stateGrid: Grid<T>;
  let statePosition: Position;
  /**
   * Read the immutable last committed grid position.
   */
  function getPosition(): Position {
    return statePosition;
  }
  /**
   * Read an item after validating its coordinates against the owned grid snapshot.
   */
  function getItem(position: Position): T {
    const checked = checkedPosition(stateGrid, position);
    const result = stateGrid[checked.row]?.[checked.col] as T;

    return result;
  }
  /**
   * Resolve one adjacent position without changing navigation state.
   */
  function getNeighbor(direction: Direction): Position | null {
    const result = findNeighbor(stateGrid, statePosition, direction);

    return result;
  }
  /**
   * Request one neighboring transition without queuing conflicting commands.
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
   * Commit a valid target position without traversing intermediate cells.
   */
  function goTo(position: Position): boolean {
    const target = checkedPosition(stateGrid, position);
    if (target.row === statePosition.row && target.col === statePosition.col) {
      const result = false;

      return result;
    }
    statePosition = target;
    const result = true;

    return result;
  }
  /**
   * Validate and replace the grid, clamp coordinates when necessary, and synchronize owned resources.
   */
  function updateGrid(grid: Grid<T>): void {
    const nextGrid = snapshotGrid(grid);
    const row = Math.min(statePosition.row, nextGrid.length - 1);
    const nextRow = nextGrid[row];
    if (nextRow === undefined) {
      throw new RangeError(CORE_TEXT.gridMustContainTheSelectedRow);
    }
    const col = Math.min(statePosition.col, nextRow.length - 1);
    stateGrid = nextGrid;
    statePosition = Object.freeze({ row, col });
  }
  stateGrid = snapshotGrid(grid);
  statePosition = checkedPosition(stateGrid, initialPosition);
  const api: NavigationModel<T> = { getPosition, getItem, getNeighbor, navigate, goTo, updateGrid };

  return api;
}
