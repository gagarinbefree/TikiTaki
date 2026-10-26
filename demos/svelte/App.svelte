<script lang="ts">
  import { onMount } from 'svelte';
  import type { Grid, Position } from 'tikitaki';
  import type { SwipeEngine } from 'tikitaki/dom';
  import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
  import { initialGrid, INITIAL_POSITION } from '../shared';
  import EngineView from './EngineView.svelte';
  import CellMap from './CellMap.svelte';
  import { isFullscreenDemo, subscribeDemoLayout } from '../responsive';
  import { metrics } from './metrics';

  let fullscreen = $state(isFullscreenDemo());
  let grid = $state.raw<Grid<string>>(initialGrid);
  let visible = $state(true);
  let position = $state.raw<Position>(INITIAL_POSITION);
  let engine = $state.raw<SwipeEngine<string> | null>(null);
  /**
   * remount
   *
   * Restore initial data before mounting another independent controller.
   */
  function remount() {
    if (!visible) {
      grid = initialGrid;
      position = INITIAL_POSITION;
    }
    visible = !visible;
  }
  /**
   * select
   *
   * Select a map cell and report controller failures.
   * @param target The requested target.
   */
  function select(target: Position) {
    void engine?.goTo(target).catch(metrics.error);
  }
  onMount(() => {
    const stopLayout = subscribeDemoLayout(() => {
      fullscreen = isFullscreenDemo();
    });
    window.tikitakiDemo.commands = {
      /**
       * navigate
       * @param direction The requested navigation direction.
       */
      navigate: (direction) => {
        void engine?.navigate(direction).catch(metrics.error);
      },
      goTo: select,
      /**
       * update
       */
      update: () => {
        grid = grid.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix));
      },
      /**
       * shrink
       */
      shrink: () => {
        grid = [[DEMO_TEXT.only]];
      },
      toggle: remount,
    };
    return () => {
      stopLayout();
      window.tikitakiDemo.commands = null;
    };
  });
</script>

<main class={DEMO_TEXT.container}>
  <div class={DEMO_TEXT.layout} data-demo-layout="">
    <div class={DEMO_TEXT.viewportColumn} style:width={DEMO_GEOMETRY.phoneColumn.width}>
      {#if visible}
        <EngineView
          {fullscreen}
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
    <CellMap {fullscreen} {grid} {position} enabled={visible} onSelect={select} />
  </div>
</main>
