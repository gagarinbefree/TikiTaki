import { CELL_THEMES, DEMO_TEXT, MOBILE_LAYOUT } from './config';
export { INITIAL_POSITION, initialGrid } from './config';

import type { Direction, Grid, Position } from 'tikitaki';
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
  const result = grid.map((items, row) =>
    items.map((label, col) => ({ label, position: { row, col }, current: enabled && position.row === row && position.col === col })),
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
  window.tikitakiDemo = { metrics: metrics.snapshot, commands: null };

  return metrics;
}
/** Browser-test operations kept outside the visible demo interface. */
export interface DemoCommands {
  readonly navigate: (direction: Direction) => void;
  readonly goTo: (position: Position) => void;
  readonly update: () => void;
  readonly shrink: () => void;
  readonly toggle: () => void;
}

declare global {
  /**
   * Expose read-only demo lifecycle diagnostics for browser verification.
   */
  interface Window {
    tikitakiDemo: {
      commands: DemoCommands | null;
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

/** Create a stable random Bootstrap appearance for each coordinate in this demo session. */
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
/** Share coordinate colors across remounted demo cells without touching the engine. */
export const cellAppearance = createCellAppearance();
