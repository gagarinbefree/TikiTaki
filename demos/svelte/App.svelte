<script lang="ts">
  import { onMount } from 'svelte';
  import type { Grid, Position } from 'tikitaki';
  import type { SwipeEngine } from 'tikitaki/dom';
  import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
  import { initialGrid, INITIAL_POSITION } from '../shared';
  import EngineView from './EngineView.svelte';
  import CellMap from './CellMap.svelte';
  import { metrics } from './metrics';

  let grid = $state.raw<Grid<string>>(initialGrid);
  let visible = $state(true);
  let position = $state.raw<Position>(INITIAL_POSITION);
  let engine = $state.raw<SwipeEngine<string> | null>(null);
  /** Restore initial data before mounting another independent controller. */
  function remount() {
    if (!visible) {
      grid = initialGrid;
      position = INITIAL_POSITION;
    }
    visible = !visible;
  }
  /** Select a map cell and report controller failures. */
  function select(target: Position) {
    void engine?.goTo(target).catch(metrics.error);
  }
  onMount(() => {
    window.tikitakiDemo.commands = {
      navigate: (direction) => {
        void engine?.navigate(direction).catch(metrics.error);
      },
      goTo: select,
      update: () => {
        grid = grid.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix));
      },
      shrink: () => {
        grid = [[DEMO_TEXT.only]];
      },
      toggle: remount,
    };
    return () => {
      window.tikitakiDemo.commands = null;
    };
  });
</script>

<main class={DEMO_TEXT.container}>
  <div class={DEMO_TEXT.layout} data-demo-layout="">
    <div class={DEMO_TEXT.viewportColumn} style:width={DEMO_GEOMETRY.phoneColumn.width}>
      {#if visible}
        <EngineView
          {grid}
          onengine={(next) => {
            engine = next;
          }}
          onposition={(next) => {
            position = next;
          }}
        />
      {:else}
        <p data-unmounted="">{DEMO_TEXT.destroyedMessage}</p>
      {/if}
    </div>
    <CellMap {grid} {position} enabled={visible} onSelect={select} />
  </div>
</main>
