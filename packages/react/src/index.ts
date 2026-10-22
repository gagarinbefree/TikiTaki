import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ADAPTER_CONFIG } from './config';
import type { Position } from 'tikitaki';
import type { CellAdapter, MountedCell } from 'tikitaki/dom';
/** An immutable React host record retaining item identity and copied coordinates. */
export interface ReactCell<T> {
  readonly key: string;
  readonly host: HTMLElement;
  readonly item: T;
  readonly position: Position;
}
/** A private external-store bridge between cell ownership and parent-root portals. */
export interface ReactCellBridge<T> {
  readonly adapter: CellAdapter<T>;
  /** Read the current immutable snapshot without exposing internal mutable state. */
  readonly getSnapshot: () => readonly ReactCell<T>[];
  /** Subscribe to committed snapshots and return an idempotent unsubscribe operation. */
  readonly subscribe: (listener: () => void) => () => void;
}
/** The owning React cell bridge and framework render callback. */
export interface ReactCellPortalsProps<T> {
  readonly bridge: ReactCellBridge<T>;
  /** Render item content inside the adapter or framework ownership boundary. */
  readonly renderCell: (item: T, position: Position) => ReactNode;
}
/**
 * Create an immutable host record without cloning or freezing user-owned item content.
 */
function entry<T>(key: string, host: HTMLElement, item: T, position: Position): ReactCell<T> {
  const result = Object.freeze({ key, host, item, position: Object.freeze({ row: position.row, col: position.col }) });

  return result;

}
/** Create once per engine view; render ReactCellPortals under its parent root. */
export function createReactCellAdapter<T>(): ReactCellBridge<T> {
  let cells: readonly ReactCell<T>[] = Object.freeze([]);
  let id = 0;
  const listeners = new Set<() => void>();
  /**
   * Publish a committed immutable snapshot to current subscribers.
   */
  function publish(next: readonly ReactCell<T>[]) {
    cells = Object.freeze(next);
    for (const listener of [...listeners]) listener();
  }
  const result: ReactCellBridge<T> = {
    adapter: {
      /**
       * Register one owned host and return its isolated update and cleanup operations.
       */
      mount(host: HTMLElement, item: T, position: Position): MountedCell<T> {
        if (cells.some((cell) => cell.host === host)) {
          throw new TypeError(ADAPTER_CONFIG.duplicateHostMessage);
        }
        const key = String(++id);
        publish([...cells, entry(key, host, item, position)]);
        let mounted = true;
        const result: MountedCell<T> = {
          /**
           * Update a live host while retaining its identity and component state.
           */
          update(next, coordinates) {
            if (!mounted)
              return;

            publish(cells.map((cell) => (cell.key === key ? entry(key, host, next, coordinates) : cell)));
          },
          /**
           * Release one mounted host exactly once and ignore stale updates.
           */
          unmount() {
            if (!mounted)
              return;

            mounted = false;
            publish(cells.filter((cell) => cell.key !== key));
          },
        };

        return result;

      },
    },
    getSnapshot: () => cells,
    /**
     * Subscribe to committed snapshots and return an idempotent unsubscribe operation.
     */
    subscribe(listener) {
      listeners.add(listener);
      const result = () => {
        listeners.delete(listener);
      };

      return result;

    },
  };

  return result;

}
/** Portal content retains the parent context, events, and component lifecycle. */
export function ReactCellPortals<T>({ bridge, renderCell }: ReactCellPortalsProps<T>): ReactNode {
  const cells = useSyncExternalStore(bridge.subscribe, bridge.getSnapshot, bridge.getSnapshot);
  const result = cells.map((cell) => createPortal(renderCell(cell.item, cell.position), cell.host, cell.key));

  return result;

}
