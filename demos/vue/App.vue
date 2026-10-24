<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import type { Direction, Grid, Position } from 'tikitaki';
import type { SwipeEngine } from 'tikitaki/dom';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { initialGrid, INITIAL_POSITION } from '../shared';
import EngineView from './EngineView.vue';
import CellMap from './CellMap.vue';
import { metrics } from './metrics';

const grid = shallowRef<Grid<string>>(initialGrid);
const visible = ref(true);
const position = shallowRef<Position>(INITIAL_POSITION);
const engine = shallowRef<SwipeEngine<string> | null>(null);

/** Request an animated transition and report rejected operations. */
function navigate(direction: Direction) {
  void engine.value?.navigate(direction).catch(metrics.error);
}
/** Select a valid map cell without creating another framework root. */
function select(target: Position) {
  void engine.value?.goTo(target).catch(metrics.error);
}
/** Replace item data while preserving component identities and local state. */
function update() {
  grid.value = grid.value.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix));
}
/** Restore initial data before mounting another independent engine. */
function remount() {
  if (!visible.value) {
    grid.value = initialGrid;
    position.value = INITIAL_POSITION;
  }
  visible.value = !visible.value;
}
onMounted(() => {
  window.tikitakiDemo.commands = {
    navigate,
    goTo: select,
    update,
    shrink: () => {
      grid.value = [[DEMO_TEXT.only]];
    },
    toggle: remount,
  };
});
onUnmounted(() => {
  window.tikitakiDemo.commands = null;
});
</script>

<template>
  <main :class="DEMO_TEXT.container">
    <div :class="DEMO_TEXT.layout" data-demo-layout="">
      <div :class="DEMO_TEXT.viewportColumn" :style="DEMO_GEOMETRY.phoneColumn">
        <EngineView v-if="visible" :grid="grid" @engine="engine = $event" @position="position = $event" />
        <p v-else data-unmounted="">{{ DEMO_TEXT.destroyedMessage }}</p>
      </div>
      <CellMap :grid="grid" :position="position" :enabled="visible" @select="select" />
    </div>
  </main>
</template>
