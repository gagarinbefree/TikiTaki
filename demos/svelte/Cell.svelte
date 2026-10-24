<script lang="ts">
  import { onMount } from 'svelte';
  import type { Position } from 'tikitaki';
  import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
  import { cellAppearance } from '../shared';
  import { metrics } from './metrics';

  let { item, position }: { readonly item: string; readonly position: Position } = $props();
  onMount(() => {
    metrics.mount();
    return metrics.unmount;
  });
</script>

<article
  class={cellAppearance(position)}
  style:height={DEMO_GEOMETRY.cell.height}
  style:box-sizing={DEMO_GEOMETRY.cell.boxSizing}
  style:border-radius={DEMO_GEOMETRY.cell.borderRadius}
  data-item={item}
  data-row={position.row}
>
  <h1 class={DEMO_TEXT.cellTitle}>{item}</h1>
</article>
