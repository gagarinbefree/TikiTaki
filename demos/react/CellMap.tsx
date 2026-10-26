import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY, MOBILE_LAYOUT } from '../config';
import { cellMapRows, type CellMapProps } from '../shared';

/**
 * CellMap
 *
 * Display the ragged grid and highlight its committed position.
 * @param options Named arguments grid, position, enabled, onSelect, fullscreen.
 * @returns The rendered cell map.
 */
export default function CellMap({ grid, position, enabled, onSelect, fullscreen }: CellMapProps & { readonly fullscreen: boolean }) {
  return (
    <nav
      style={fullscreen ? MOBILE_LAYOUT.mapGeometry : DEMO_GEOMETRY.map}
      className={fullscreen ? MOBILE_LAYOUT.map : DEMO_TEXT.gridMap}
      aria-label={DEMO_TEXT.cellMapTitle}
    >
      {!fullscreen && (
        <div className={DEMO_TEXT.gridMapHeader}>
          <span className={DEMO_TEXT.gridMapLegend}>{DEMO_TEXT.currentCellLegend}</span>
        </div>
      )}
      {!fullscreen && <p className={DEMO_TEXT.hint}>{DEMO_TEXT.cellMapHint}</p>}
      <div className={fullscreen ? MOBILE_LAYOUT.rows : DEMO_TEXT.gridMapScroll}>
        {cellMapRows({ grid, position, enabled }).map((cells, row) => (
          <p
            key={row}
            className={fullscreen ? MOBILE_LAYOUT.row : DEMO_TEXT.gridMapRow}
            data-map-row={row}
            role="group"
            aria-label={DEMO_LABELS.row(row)}
          >
            {cells.map((cell) => (
              <button
                key={cell.position.col}
                type="button"
                className={
                  fullscreen
                    ? cell.current
                      ? MOBILE_LAYOUT.currentCell
                      : MOBILE_LAYOUT.cell
                    : cell.current
                      ? DEMO_TEXT.gridMapCurrentCell
                      : DEMO_TEXT.gridMapCell
                }
                style={fullscreen && cell.current ? MOBILE_LAYOUT.currentCellGeometry : undefined}
                data-bs-target={fullscreen ? '' : undefined}
                disabled={!enabled}
                title={DEMO_LABELS.coordinates(cell.position)}
                aria-current={cell.current ? true : undefined}
                onClick={() => {
                  onSelect(cell.position);
                }}
              >
                <span className={fullscreen ? MOBILE_LAYOUT.label : undefined}>{cell.label}</span>
              </button>
            ))}
          </p>
        ))}
      </div>
    </nav>
  );
}
