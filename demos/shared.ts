import { CELL_THEMES, DEMO_TEXT, MOBILE_LAYOUT } from './config';
export { INITIAL_POSITION, initialGrid } from './config';

import type { Direction, Grid, Position } from 'tikitaki';
/** Current demo data, committed coordinates, availability, and the direct navigation callback. */
export interface CellMapProps {
  readonly grid: Grid<string>;
  readonly position: Position;
  readonly enabled: boolean;
  /**
   * onSelect
   *
   * Request direct navigation to the selected valid map coordinates.
   * @param position Zero based cell coordinates.
   */
  readonly onSelect: (position: Position) => void;
}
/**
 * cellMapRows
 *
 * Describe map buttons from current data and the committed controller position.
 * @param options Named arguments grid, position, enabled.
 * @returns The resulting array.
 */
export function cellMapRows({ grid, position, enabled }: Pick<CellMapProps, 'grid' | 'position' | 'enabled'>) {
  const result = grid.map((items, row) =>
    items.map((label, col) => ({ label, position: { row, col }, current: enabled && position.row === row && position.col === col })),
  );

  return result;
}
/**
 * createMetrics
 *
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
    /**
     * mount
     */
    mount: () => {
      mounted++;
    },
    /**
     * unmount
     */
    unmount: () => {
      unmounted++;
    },
    /**
     * createEngine
     */
    createEngine: () => {
      enginesCreated++;
    },
    /**
     * destroyEngine
     */
    destroyEngine: () => {
      enginesDestroyed++;
    },
    /**
     * error
     * @param error The failure to report or normalize.
     */
    error: (error: unknown) => {
      errors.push(error instanceof Error ? error.message : String(error));
    },
    /**
     * snapshot
     * @returns The current mount, unmount, engine, and error diagnostics.
     */
    snapshot: () => ({ mounted, unmounted, live: mounted - unmounted, enginesCreated, enginesDestroyed, errors: [...errors] }),
  };
  window.tikitakiDemo = { metrics: metrics.snapshot, commands: null };

  return metrics;
}
/** Browser test operations kept outside the visible demo interface. */
export interface DemoCommands {
  /**
   * navigate
   * @param direction The requested navigation direction.
   */
  readonly navigate: (direction: Direction) => void;
  /**
   * goTo
   * @param position Zero based cell coordinates.
   */
  readonly goTo: (position: Position) => void;
  /**
   * update
   */
  readonly update: () => void;
  /**
   * shrink
   */
  readonly shrink: () => void;
  /**
   * toggle
   */
  readonly toggle: () => void;
}

declare global {
  /**
   * Expose readonly demo lifecycle diagnostics for browser verification.
   */
  interface Window {
    tikitakiDemo: {
      commands: DemoCommands | null;
      /**
       * metrics
       * @returns The current mount, unmount, engine, and error diagnostics.
       */
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

/**
 * createCellAppearance
 *
 * Create a stable random Bootstrap appearance for each coordinate in this demo session.
 * @returns The callback or factory created by this function.
 */
function createCellAppearance() {
  const themes = new Map<string, string>();
  return (position: Position, fullscreen = false): string => {
    const key = `${String(position.row)}:${String(position.col)}`;
    let theme = themes.get(key);
    if (theme === undefined) {
      theme = CELL_THEMES[Math.floor(Math.random() * CELL_THEMES.length)] ?? 'secondary';
      themes.set(key, theme);
    }
    const displayTheme = fullscreen && theme === MOBILE_LAYOUT.excludedTheme ? MOBILE_LAYOUT.fallbackTheme : theme;
    return `${DEMO_TEXT.cell} theme-${displayTheme} theme-contrast`;
  };
}
/**
 * cellAppearance
 *
 * Share coordinate colors across remounted demo cells without touching the engine.
 * @param position Zero based cell coordinates.
 * @param fullscreen Whether mobile portrait mode is active.
 * @returns The Bootstrap cell appearance classes.
 */
export const cellAppearance = createCellAppearance();
