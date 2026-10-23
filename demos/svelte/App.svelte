<script lang="ts">
  import { onMount, setContext } from 'svelte';
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
  setContext(DEMO_TEXT.context, DEMO_TEXT.svelteContext);
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
  <a href={DEMO_TEXT.homePath}>{DEMO_TEXT.demos}</a>
  <p><span class={DEMO_TEXT.badge}>{DEMO_TEXT.tikiTakiSvelte}</span></p>
  <div class={DEMO_TEXT.pageHeader}><h1>{DEMO_TEXT.headline}</h1></div>
  <p>{DEMO_TEXT.intro}</p>
  <h3>{DEMO_TEXT.liveTitle}</h3>
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
