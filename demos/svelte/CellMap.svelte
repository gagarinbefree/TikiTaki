<script lang="ts">
  import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
  import { cellMapRows, type CellMapProps } from '../shared';

  let { grid, position, enabled, onSelect }: CellMapProps = $props();
  const rows = $derived(cellMapRows({ grid, position, enabled }));
</script>

<nav
  style:min-width={DEMO_GEOMETRY.map.minWidth}
  style:min-height={DEMO_GEOMETRY.map.minHeight}
  style:position={DEMO_GEOMETRY.map.position}
  style:bottom={DEMO_GEOMETRY.map.bottom}
  style:left={DEMO_GEOMETRY.map.left}
  style:transform={DEMO_GEOMETRY.map.transform}
  style:z-index={DEMO_GEOMETRY.map.zIndex}
  style:width={DEMO_GEOMETRY.map.width}
  style:max-width={DEMO_GEOMETRY.map.maxWidth}
  style:padding={DEMO_GEOMETRY.map.padding}
  style:background-color={DEMO_GEOMETRY.map.backgroundColor}
  style:border-width={DEMO_GEOMETRY.map.borderWidth}
  class={DEMO_TEXT.gridMap}
  aria-label={DEMO_TEXT.cellMapTitle}
>
  <div class={DEMO_TEXT.gridMapHeader}>
    <span class={DEMO_TEXT.gridMapLegend}>{DEMO_TEXT.currentCellLegend}</span>
  </div>
  <p class={DEMO_TEXT.hint}>{DEMO_TEXT.cellMapHint}</p>
  <div
    class={DEMO_TEXT.gridMapScroll}
    style:display={DEMO_GEOMETRY.mapRows.display}
    style:align-items={DEMO_GEOMETRY.mapRows.alignItems}
    style:justify-content={DEMO_GEOMETRY.mapRows.justifyContent}
    style:flex-wrap={DEMO_GEOMETRY.mapRows.flexWrap}
    style:gap={DEMO_GEOMETRY.mapRows.gap}
  >
    {#each rows as cells, row (row)}
      <p
        class={DEMO_TEXT.gridMapRow}
        style:display={DEMO_GEOMETRY.mapRow.display}
        style:margin-bottom={DEMO_GEOMETRY.mapRow.marginBottom}
        data-map-row={row}
        role="group"
        aria-label={DEMO_LABELS.row(row)}
      >
        {#each cells as cell (cell.position.col)}
          <button
            type="button"
            class={cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell}
            style:width={cell.current ? DEMO_GEOMETRY.mapCurrentCell.width : DEMO_GEOMETRY.mapCell.width}
            style:height={cell.current ? DEMO_GEOMETRY.mapCurrentCell.height : DEMO_GEOMETRY.mapCell.height}
            style:padding={DEMO_GEOMETRY.mapCell.padding}
            style:font-size={DEMO_GEOMETRY.mapCell.fontSize}
            style:min-height={DEMO_GEOMETRY.mapCell.minHeight}
            style:border-radius={DEMO_GEOMETRY.mapCell.borderRadius}
            disabled={!enabled}
            title={DEMO_LABELS.coordinates(cell.position)}
            aria-current={cell.current ? true : undefined}
            onclick={() => {
              onSelect(cell.position);
            }}>{cell.label}</button
          >
        {/each}
      </p>
    {/each}
  </div>
</nav>
