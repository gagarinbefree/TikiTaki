import { NAVIGATION_TARGET_POSITION } from './config';
export { INITIAL_POSITION, NAVIGATION_TARGET_POSITION, initialGrid, controls } from './config';

import type { Grid, Position } from 'tikitaki';
/**
 * Check that the direct-navigation example still exists in a replacement grid.
 */
export function hasNavigationTarget(grid: Grid<unknown>): boolean {
  const result = (grid[NAVIGATION_TARGET_POSITION.row]?.length ?? 0) > NAVIGATION_TARGET_POSITION.col;

  return result;

}
/** Current demo data, committed coordinates, availability, and the direct-navigation callback. */
export interface CellMapProps {
  readonly grid: Grid<string>;
  readonly position: Position;
  readonly enabled: boolean;
  /** Request direct navigation to the selected valid map coordinates. */
  readonly onSelect: (position: Position) => void;
}
/**
 * Describe map buttons from current data and the committed controller position.
 */
export function cellMapRows({ grid, position, enabled }: Pick<CellMapProps, 'grid' | 'position' | 'enabled'>) {
  const result = grid.map((items, row) => items.map((label, col) => ({ label, position: { row, col }, current: enabled && position.row === row && position.col === col })),
  );

  return result;

}
/**
 * Create independent lifecycle counters for browser verification.
 * @returns Independent operations that can be called without binding a receiver.
 */
export function createMetrics() {
  let mounted = 0,
    unmounted = 0,
    enginesCreated = 0,
    enginesDestroyed = 0;
  const errors: string[] = [];
  const metrics = {
    mount: () => {
      mounted++;
    },
    unmount: () => {
      unmounted++;
    },
    createEngine: () => {
      enginesCreated++;
    },
    destroyEngine: () => {
      enginesDestroyed++;
    },
    error: (error: unknown) => {
      errors.push(error instanceof Error ? error.message : String(error));
    },
    snapshot: () => ({ mounted, unmounted, live: mounted - unmounted, enginesCreated, enginesDestroyed, errors: [...errors] }),
  };
  window.tikitakiDemo = { metrics: metrics.snapshot };

  return metrics;

}
declare global {
  /**
   * Expose read-only demo lifecycle diagnostics for browser verification.
   */
  interface Window {
    tikitakiDemo: {
      readonly metrics: () => {
        readonly mounted: number;
        readonly unmounted: number;
        readonly live: number;
        readonly enginesCreated: number;
        readonly enginesDestroyed: number;
        readonly errors: readonly string[];
      };
    };
  }
}
