import { html, nothing, render } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { DEMO_LABELS, DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { cellMapRows } from '../shared';
import type { CellMapProps } from '../shared';

/** Render the shared ragged-grid map using Lit event and attribute bindings. */
export function renderCellMap(host: HTMLElement, props: CellMapProps): void {
  render(
    html`${cellMapRows(props).map(
      (cells, row) =>
        html` <p
          class=${DEMO_TEXT.gridMapRow}
          style=${styleMap(DEMO_GEOMETRY.mapRow)}
          data-map-row=${row}
          role="group"
          aria-label=${DEMO_LABELS.row(row)}
        >
          ${cells.map(
            (cell) =>
              html`<button
                type="button"
                class=${cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell}
                style=${styleMap({ ...DEMO_GEOMETRY.mapCell, ...(cell.current ? DEMO_GEOMETRY.mapCurrentCell : {}) })}
                title=${DEMO_LABELS.coordinates(cell.position)}
                ?disabled=${!props.enabled}
                aria-current=${cell.current ? 'true' : nothing}
                @click=${() => {
                  props.onSelect(cell.position);
                }}
              >
                ${cell.label}
              </button>`,
          )}
        </p>`,
    )} `,
    host,
  );
}
