import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { cellMapRows, type CellMapProps } from '../shared';

/** Display the ragged grid and highlight its committed position. */
export default function CellMap({ grid, position, enabled, onSelect }: CellMapProps) {
  return (
    <nav style={DEMO_GEOMETRY.map} className={DEMO_TEXT.gridMap} aria-label={DEMO_TEXT.cellMapTitle}>
      <div className={DEMO_TEXT.gridMapHeader}>
        <h2>{DEMO_TEXT.cellMapTitle}</h2>
        <span className={DEMO_TEXT.gridMapLegend}>{DEMO_TEXT.currentCellLegend}</span>
      </div>
      <p className={DEMO_TEXT.hint}>{DEMO_TEXT.cellMapHint}</p>
      <div className={DEMO_TEXT.gridMapScroll}>
        {cellMapRows({ grid, position, enabled }).map((cells, row) => (
          <p key={row} className={DEMO_TEXT.gridMapRow} data-map-row={row} role="group" aria-label={DEMO_LABELS.row(row)}>
            {cells.map((cell) => (
              <button
                key={cell.position.col}
                type="button"
                className={cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell}
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
