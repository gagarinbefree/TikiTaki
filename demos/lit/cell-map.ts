import { html, nothing, render } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { DEMO_LABELS, DEMO_TEXT, MOBILE_LAYOUT } from '../config';
import { cellMapRows } from '../shared';
import type { CellMapProps } from '../shared';

/** Render the shared ragged-grid map using Lit event and attribute bindings. */
export function renderCellMap(host: HTMLElement, props: CellMapProps & { readonly fullscreen: boolean }): void {
  render(
    html`${cellMapRows(props).map(
      (cells, row) =>
        html` <p
          class=${props.fullscreen ? MOBILE_LAYOUT.row : DEMO_TEXT.gridMapRow}
          data-map-row=${row}
          role="group"
          aria-label=${DEMO_LABELS.row(row)}
        >
          ${cells.map(
            (cell) =>
              html`<button
                type="button"
                class=${props.fullscreen ? (cell.current ? MOBILE_LAYOUT.currentCell : MOBILE_LAYOUT.cell) : cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell}
                style=${styleMap(props.fullscreen && cell.current ? MOBILE_LAYOUT.currentCellGeometry : {})}
                data-bs-target=${props.fullscreen ? '' : nothing}
                title=${DEMO_LABELS.coordinates(cell.position)}
                ?disabled=${!props.enabled}
                aria-current=${cell.current ? 'true' : nothing}
                @click=${() => {
                  props.onSelect(cell.position);
                }}
              >
                <span class=${props.fullscreen ? MOBILE_LAYOUT.label : nothing}>${cell.label}</span>
              </button>`,
          )}
        </p>`,
    )} `,
    host,
  );
}
