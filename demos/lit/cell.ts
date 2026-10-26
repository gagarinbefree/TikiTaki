import { html, nothing, render } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { DEMO_GEOMETRY, DEMO_TEXT } from '../config';
import { cellAppearance } from '../shared';
import { isFullscreenDemo, subscribeDemoLayout } from '../responsive';
import type { createMetrics } from '../shared';
import type { Position } from 'tikitaki';
import type { CellAdapter } from 'tikitaki/dom';

/**
 * createLitCellAdapter
 *
 * Render Lit templates only inside engine owned cell hosts and release them on unmount.
 * @param metrics The lifecycle diagnostics to update.
 * @returns The cell adapter with mount, update, and unmount operations.
 */
export function createLitCellAdapter(metrics: ReturnType<typeof createMetrics>): CellAdapter<string> {
  return {
    /**
     * mount
     * @param host The engine owned cell host.
     * @param item The cell data to render.
     * @param position Zero based cell coordinates.
     * @returns The callback or factory created by this function.
     */
    mount(host, item, position) {
      let released = false;
      let currentItem = item;
      let currentPosition = position;
      /**
       * update
       *
       * Update one mounted Lit template without replacing its engine owned host.
       * @param nextItem The updated cell data.
       * @param nextPosition The updated cell coordinates.
       */
      function update(nextItem: string, nextPosition: Position): void {
        if (released) return;
        currentItem = nextItem;
        currentPosition = nextPosition;
        render(
          html`<article
            class=${cellAppearance(nextPosition, isFullscreenDemo())}
            style=${styleMap(DEMO_GEOMETRY.cell)}
            data-item=${nextItem}
            data-row=${nextPosition.row}
          >
            <h1 class=${DEMO_TEXT.cellTitle}>${nextItem}</h1>
          </article>`,
          host,
        );
      }
      metrics.mount();
      update(item, position);
      const stopColor = subscribeDemoLayout(() => {
        update(currentItem, currentPosition);
      });
      return {
        update,
        /**
         * unmount
         */
        unmount() {
          if (released) return;
          released = true;
          stopColor();
          render(nothing, host);
          metrics.unmount();
        },
      };
    },
  };
}
