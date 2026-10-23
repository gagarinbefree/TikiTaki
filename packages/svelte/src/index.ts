import { readonly, writable, type Readable } from 'svelte/store';
import { ADAPTER_CONFIG } from './config';
import type { Position } from 'tikitaki';
import type { CellAdapter, MountedCell } from 'tikitaki/dom';

/** Immutable host record retaining the identity of user-owned content. */
export interface SvelteCell<T> {
  readonly key: string;
  readonly host: HTMLElement;
  readonly item: T;
  readonly position: Position;
}
/** Readonly store consumed by keyed components under the owning Svelte application. */
export interface SvelteCellBridge<T> {
  readonly adapter: CellAdapter<T>;
  readonly cells: Readable<readonly SvelteCell<T>[]>;
}
/** Copy coordinates without cloning or freezing user-owned data. */
function entry<T>(key: string, host: HTMLElement, item: T, position: Position): SvelteCell<T> {
  return Object.freeze({ key, host, item, position: Object.freeze({ row: position.row, col: position.col }) });
}
/** Create one bridge per engine view; render its keyed cells with the portal action. */
export function createSvelteCellAdapter<T>(): SvelteCellBridge<T> {
  let cells: readonly SvelteCell<T>[] = Object.freeze([]);
  const store = writable(cells);
  let id = 0;
  /** Publish an immutable snapshot to active component subscriptions. */
  function publish(next: readonly SvelteCell<T>[]) {
    cells = Object.freeze(next);
    store.set(cells);
  }
  return {
    cells: readonly(store),
    adapter: {
      /** Own one host while letting Svelte manage its descendants and lifecycle. */
      mount(host: HTMLElement, item: T, position: Position): MountedCell<T> {
        if (cells.some((cell) => cell.host === host)) throw new TypeError(ADAPTER_CONFIG.duplicateHostMessage);
        const key = String(++id);
        publish([...cells, entry(key, host, item, position)]);
        let mounted = true;
        return {
          /** Retain the key so component state survives item updates. */
          update(next, coordinates) {
            if (!mounted) return;
            publish(cells.map((cell) => (cell.key === key ? entry(key, host, next, coordinates) : cell)));
          },
          /** Release once; stale operations cannot revive a removed component. */
          unmount() {
            if (!mounted) return;
            mounted = false;
            publish(cells.filter((cell) => cell.key !== key));
          },
        };
      },
    },
  };
}
/** Move a framework-owned wrapper into its host without creating another Svelte root. */
export function portal(node: HTMLElement, target: HTMLElement) {
  let host = target;
  let active = true;
  host.append(node);
  return {
    /** Move the same component subtree when its host changes. */
    update(next: HTMLElement) {
      if (!active || next === host) return;
      host = next;
      host.append(node);
    },
    /** Remove only the owned wrapper and leave unrelated host content untouched. */
    destroy() {
      if (!active) return;
      active = false;
      if (node.parentNode === host) node.remove();
    },
  };
}
