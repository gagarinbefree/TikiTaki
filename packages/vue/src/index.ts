import { Fragment, h, shallowReadonly, shallowRef, Teleport } from 'vue';
import { ADAPTER_CONFIG } from './config';
import type { ShallowRef, VNodeChild } from 'vue';
import type { Position } from 'tikitaki';
import type { CellAdapter, MountedCell } from 'tikitaki/dom';
/** An immutable Vue host record retaining item identity and copied coordinates. */
export interface VueCell<T> {
  readonly key: string;
  readonly host: HTMLElement;
  readonly item: T;
  readonly position: Position;
}
/** A readonly shallow cell store shared by the engine adapter and parent-app Teleports. */
export interface VueCellBridge<T> {
  readonly adapter: CellAdapter<T>;
  readonly cells: Readonly<ShallowRef<readonly VueCell<T>[]>>;
}
/** The owning Vue cell bridge and framework render callback. */
export interface VueCellPortalsProps<T> {
  readonly bridge: VueCellBridge<T>;
  /** Render item content inside the adapter or framework ownership boundary. */
  readonly renderCell: (item: T, position: Position) => VNodeChild;
}
/**
 * Create an immutable host record without cloning or freezing user-owned item content.
 */
function entry<T>(key: string, host: HTMLElement, item: T, position: Position): VueCell<T> {
  const result = Object.freeze({ key, host, item, position: Object.freeze({ row: position.row, col: position.col }) });

  return result;
}
/** Create in setup; render VueCellPortals inside the owning Vue application. */
export function createVueCellAdapter<T>(): VueCellBridge<T> {
  const cells = shallowRef<readonly VueCell<T>[]>(Object.freeze([]));
  let id = 0;
  const result: VueCellBridge<T> = {
    adapter: {
      /**
       * Register one owned host and return its isolated update and cleanup operations.
       */
      mount(host: HTMLElement, item: T, position: Position): MountedCell<T> {
        if (cells.value.some((cell) => cell.host === host)) {
          throw new TypeError(ADAPTER_CONFIG.duplicateHostMessage);
        }
        const key = String(++id);
        cells.value = Object.freeze([...cells.value, entry(key, host, item, position)]);
        let mounted = true;
        const result: MountedCell<T> = {
          /**
           * Update a live host while retaining its identity and component state.
           */
          update(next, coordinates) {
            if (!mounted) return;

            cells.value = Object.freeze(cells.value.map((cell) => (cell.key === key ? entry(key, host, next, coordinates) : cell)));
          },
          /**
           * Release one mounted host exactly once and ignore stale updates.
           */
          unmount() {
            if (!mounted) return;

            mounted = false;
            cells.value = Object.freeze(cells.value.filter((cell) => cell.key !== key));
          },
        };

        return result;
      },
    },
    cells: shallowReadonly(cells),
  };

  return result;
}
/** Teleport preserves provide/inject and the parent application's lifecycle. */
export function VueCellPortals<T>({ bridge, renderCell }: VueCellPortalsProps<T>): VNodeChild {
  const result = h(
    Fragment,
    bridge.cells.value.map((cell) => h(Teleport, { to: cell.host, key: cell.key }, [renderCell(cell.item, cell.position)])),
  );

  return result;
}
