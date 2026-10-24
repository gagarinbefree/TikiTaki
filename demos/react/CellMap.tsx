import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { cellMapRows, type CellMapProps } from '../shared';

/** Display the ragged grid and highlight its committed position. */
export default function CellMap({ grid, position, enabled, onSelect }: CellMapProps) {
  return (
    <nav style={DEMO_GEOMETRY.map} className={DEMO_TEXT.gridMap} aria-label={DEMO_TEXT.cellMapTitle}>
      <div className={DEMO_TEXT.gridMapHeader}>
        <span className={DEMO_TEXT.gridMapLegend}>{DEMO_TEXT.currentCellLegend}</span>
      </div>
      <p className={DEMO_TEXT.hint}>{DEMO_TEXT.cellMapHint}</p>
      <div className={DEMO_TEXT.gridMapScroll} style={DEMO_GEOMETRY.mapRows}>
        {cellMapRows({ grid, position, enabled }).map((cells, row) => (
          <p
            key={row}
            className={DEMO_TEXT.gridMapRow}
            style={DEMO_GEOMETRY.mapRow}
            data-map-row={row}
            role="group"
            aria-label={DEMO_LABELS.row(row)}
          >
            {cells.map((cell) => (
              <button
                key={cell.position.col}
                type="button"
                className={cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell}
                style={{ ...DEMO_GEOMETRY.mapCell, ...(cell.current ? DEMO_GEOMETRY.mapCurrentCell : {}) }}
                disabled={!enabled}
                title={DEMO_LABELS.coordinates(cell.position)}
                aria-current={cell.current ? true : undefined}
                onClick={() => {
                  onSelect(cell.position);
                }}
              >
                {cell.label}
              </button>
            ))}
          </p>
        ))}
      </div>
    </nav>
  );
}
