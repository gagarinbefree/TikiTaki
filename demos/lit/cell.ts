import { html, nothing, render } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { DEMO_GEOMETRY, DEMO_TEXT } from '../config';
import { cellAppearance } from '../shared';
import { isFullscreenDemo, subscribeDemoLayout } from '../responsive';
import type { createMetrics } from '../shared';
import type { Position } from 'tikitaki';
import type { CellAdapter } from 'tikitaki/dom';

/** Render Lit templates only inside engine-owned cell hosts and release them on unmount. */
export function createLitCellAdapter(metrics: ReturnType<typeof createMetrics>): CellAdapter<string> {
  return {
    mount(host, item, position) {
      let released = false;
      let currentItem = item;
      let currentPosition = position;
      /** Update one mounted Lit template without replacing its engine-owned host. */
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
