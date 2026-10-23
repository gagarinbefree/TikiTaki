<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import type { Position } from 'tikitaki';
  import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
  import { metrics } from './metrics';

  let { item, position }: { readonly item: string; readonly position: Position } = $props();
  const context = getContext<string>(DEMO_TEXT.context);
  let count = $state(0);
  onMount(() => {
    metrics.mount();
    return metrics.unmount;
  });
</script>

<article
  class={DEMO_TEXT.cell}
  style:height={DEMO_GEOMETRY.cell.height}
  style:box-sizing={DEMO_GEOMETRY.cell.boxSizing}
  data-item={item}
  data-row={position.row}
>
  <small>{context}</small>
  <h1 class={DEMO_TEXT.cellTitle}>{item}</h1>
  <p>{DEMO_TEXT.swipeHint}</p>
  <button
    data-action={DEMO_TEXT.count}
    class={DEMO_TEXT.buttonPrimary}
    onclick={() => {
      count++;
    }}>{DEMO_LABELS.counter(count)}</button
  >
</article>
