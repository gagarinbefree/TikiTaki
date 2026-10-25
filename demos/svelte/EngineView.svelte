<script lang="ts">
  import { onMount } from 'svelte';
  import { createSvelteCellAdapter, portal } from '@tikitaki_gagarinbefree/svelte';
  import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
  import type { Grid, Position } from 'tikitaki';
  import { DEMO_TEXT, DEMO_GEOMETRY, MOBILE_LAYOUT } from '../config';
  import { INITIAL_POSITION } from '../shared';
  import Cell from './Cell.svelte';
  import { metrics } from './metrics';

  let {
    fullscreen,
    grid,
    onengine,
    onposition,
  }: {
    readonly fullscreen: boolean;
    readonly grid: Grid<string>;
    readonly onengine: (engine: SwipeEngine<string> | null) => void;
    readonly onposition: (position: Position) => void;
  } = $props();
  let container: HTMLDivElement;
  let engine: SwipeEngine<string> | null = null;
  const bridge = createSvelteCellAdapter<string>();
  const cells = bridge.cells;
  onMount(() => {
    engine = createSwipeEngine({
      container,
      grid,
      initialPosition: INITIAL_POSITION,
      adapter: bridge.adapter,
      onPositionChange: (next) => {
        onposition(next);
      },
      onError: metrics.error,
    });
    onengine(engine);
    metrics.createEngine();
    return () => {
      engine?.destroy();
      engine = null;
      onengine(null);
      metrics.destroyEngine();
    };
  });
  $effect(() => {
    const next = grid;
    engine?.updateGrid(next);
  });
</script>

<div
  bind:this={container}
  class={fullscreen ? MOBILE_LAYOUT.viewport : DEMO_TEXT.viewport}
  style:width={fullscreen ? undefined : DEMO_GEOMETRY.viewport.width}
  style:aspect-ratio={fullscreen ? undefined : DEMO_GEOMETRY.viewport.aspectRatio}
  data-demo-container=""
  aria-label={DEMO_TEXT.viewportLabel}
></div>
{#each $cells as cell (cell.key)}
  <div use:portal={cell.host} style:height={DEMO_GEOMETRY.cell.height}>
    <Cell item={cell.item} position={cell.position} />
  </div>
{/each}
