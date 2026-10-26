import type { EmbeddedViewRef } from '@angular/core';
import type { Position } from 'tikitaki';
import type { CellAdapter, MountedCell } from 'tikitaki/dom';
import { ADAPTER_CONFIG } from './config';

/** Template context for a cell rendered inside the parent Angular application. */
export interface AngularCellContext<T> {
  $implicit: T;
  position: Position;
}
/** Minimal embedded view ownership contract, compatible with Angular's EmbeddedViewRef. */
export interface AngularCellView<T> extends Pick<
  EmbeddedViewRef<AngularCellContext<T>>,
  'context' | 'detectChanges' | 'destroy' | 'destroyed'
> {
  readonly rootNodes: readonly Node[];
}
/**
 * coordinates
 *
 * Copy coordinates without freezing user owned cell data.
 * @param position Zero based cell coordinates.
 * @returns The resulting cell coordinates.
 */
function coordinates(position: Position): Position {
  return Object.freeze({ row: position.row, col: position.col });
}
/**
 * createAngularCellAdapter
 *
 * Create parent owned template views; never bootstrap another Angular application per cell.
 * @param createView The create view argument.
 * @returns The cell adapter with mount, update, and unmount operations.
 */
export function createAngularCellAdapter<T>(createView: (context: AngularCellContext<T>) => AngularCellView<T>): CellAdapter<T> {
  const hosts = new Set<HTMLElement>();
  return {
    /**
     * mount
     *
     * Render one embedded view into the given host and return isolated lifecycle operations.
     * @param host The engine owned cell host.
     * @param item The cell data to render.
     * @param position Zero based cell coordinates.
     * @returns The mounted cell update and cleanup operations.
     */
    mount(host: HTMLElement, item: T, position: Position): MountedCell<T> {
      if (hosts.has(host)) throw new TypeError(ADAPTER_CONFIG.duplicateHostMessage);
      const view = createView({ $implicit: item, position: coordinates(position) });
      const nodes = [...view.rootNodes];
      hosts.add(host);
      try {
        view.detectChanges();
        host.append(...nodes);
      } catch (error) {
        hosts.delete(host);
        view.destroy();
        throw error;
      }
      let mounted = true;
      return {
        /**
         * update
         *
         * Reuse the embedded view so surviving component state and injection context persist.
         * @param next The replacement value.
         * @param position Zero based cell coordinates.
         */
        update(next, position) {
          if (!mounted || view.destroyed) return;
          view.context.$implicit = next;
          view.context.position = coordinates(position);
          view.detectChanges();
        },
        /**
         * unmount
         *
         * Destroy hooks run once; unrelated host content is preserved.
         */
        unmount() {
          if (!mounted) return;
          mounted = false;
          hosts.delete(host);
          try {
            if (!view.destroyed) view.destroy();
          } finally {
            for (const node of nodes) if (node.parentNode === host) host.removeChild(node);
          }
        },
      };
    },
  };
}
