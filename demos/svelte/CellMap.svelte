<script lang="ts">
  import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
  import { cellMapRows, type CellMapProps } from '../shared';

  let { grid, position, enabled, onSelect }: CellMapProps = $props();
  const rows = $derived(cellMapRows({ grid, position, enabled }));
</script>

<nav
  style:min-width={DEMO_GEOMETRY.map.minWidth}
  style:min-height={DEMO_GEOMETRY.map.minHeight}
  class={DEMO_TEXT.gridMap}
  aria-label={DEMO_TEXT.cellMapTitle}
>
  <div class={DEMO_TEXT.gridMapHeader}>
    <span class={DEMO_TEXT.gridMapLegend}>{DEMO_TEXT.currentCellLegend}</span>
  </div>
  <p class={DEMO_TEXT.hint}>{DEMO_TEXT.cellMapHint}</p>
  <div class={DEMO_TEXT.gridMapScroll}>
    {#each rows as cells, row (row)}
      <p class={DEMO_TEXT.gridMapRow} data-map-row={row} role="group" aria-label={DEMO_LABELS.row(row)}>
        {#each cells as cell (cell.position.col)}
          <button
            type="button"
            class={cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell}
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
