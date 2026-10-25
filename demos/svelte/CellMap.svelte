<script lang="ts">
  import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY, MOBILE_LAYOUT } from '../config';
  import { cellMapRows, type CellMapProps } from '../shared';

  let { grid, position, enabled, onSelect, fullscreen }: CellMapProps & { readonly fullscreen: boolean } = $props();
  const rows = $derived(cellMapRows({ grid, position, enabled }));
</script>

<nav
  style:min-width={DEMO_GEOMETRY.map.minWidth}
  style:min-height={DEMO_GEOMETRY.map.minHeight}
  style:padding-bottom={fullscreen ? MOBILE_LAYOUT.mapGeometry.paddingBottom : undefined}
  style:--bs-carousel-indicator-width={fullscreen ? MOBILE_LAYOUT.mapGeometry['--bs-carousel-indicator-width'] : undefined}
  style:--bs-carousel-indicator-height={fullscreen ? MOBILE_LAYOUT.mapGeometry['--bs-carousel-indicator-height'] : undefined}
  style:--bs-carousel-indicator-bg={fullscreen ? MOBILE_LAYOUT.mapGeometry['--bs-carousel-indicator-bg'] : undefined}
  class={fullscreen ? MOBILE_LAYOUT.map : DEMO_TEXT.gridMap}
  aria-label={DEMO_TEXT.cellMapTitle}
>
  {#if !fullscreen}<div class={DEMO_TEXT.gridMapHeader}>
      <span class={DEMO_TEXT.gridMapLegend}>{DEMO_TEXT.currentCellLegend}</span>
    </div>
    <p class={DEMO_TEXT.hint}>{DEMO_TEXT.cellMapHint}</p>
  {/if}
  <div class={fullscreen ? MOBILE_LAYOUT.rows : DEMO_TEXT.gridMapScroll}>
    {#each rows as cells, row (row)}
      <p class={fullscreen ? MOBILE_LAYOUT.row : DEMO_TEXT.gridMapRow} data-map-row={row} role="group" aria-label={DEMO_LABELS.row(row)}>
        {#each cells as cell (cell.position.col)}
          <button
            type="button"
            class={fullscreen
              ? cell.current
                ? MOBILE_LAYOUT.currentCell
                : MOBILE_LAYOUT.cell
              : cell.current
                ? DEMO_TEXT.gridMapCurrentCell
                : DEMO_TEXT.gridMapCell}
            style:--bs-carousel-indicator-width={fullscreen && cell.current
              ? MOBILE_LAYOUT.currentCellGeometry['--bs-carousel-indicator-width']
              : undefined}
            style:--bs-carousel-indicator-height={fullscreen && cell.current
              ? MOBILE_LAYOUT.currentCellGeometry['--bs-carousel-indicator-height']
              : undefined}
            data-bs-target={fullscreen ? '' : undefined}
            disabled={!enabled}
            title={DEMO_LABELS.coordinates(cell.position)}
            aria-current={cell.current ? true : undefined}
            onclick={() => {
              onSelect(cell.position);
            }}><span class={fullscreen ? MOBILE_LAYOUT.label : undefined}>{cell.label}</span></button
          >
        {/each}
      </p>
    {/each}
  </div>
</nav>
