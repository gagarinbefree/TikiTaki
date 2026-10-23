<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { createVueCellAdapter } from '@tikitaki/vue';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import type { Grid, Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { INITIAL_POSITION } from '../shared';
import Cell from './Cell.vue';
import { metrics } from './metrics';

const props = defineProps<{ readonly grid: Grid<string> }>();
const emit = defineEmits<{ engine: [engine: SwipeEngine<string> | null]; position: [position: Position] }>();
const container = shallowRef<HTMLElement | null>(null);
const bridge = createVueCellAdapter<string>();
const cells = bridge.cells;
let engine: SwipeEngine<string> | null = null;

onMounted(() => {
  if (container.value === null) return;
  engine = createSwipeEngine({
    container: container.value,
    grid: props.grid,
    initialPosition: INITIAL_POSITION,
    adapter: bridge.adapter,
    onPositionChange: (next) => emit('position', next),
    onError: metrics.error,
  });
  emit('engine', engine);
  metrics.createEngine();
});
watch(
  () => props.grid,
  (next) => {
    engine?.updateGrid(next);
  },
);
onBeforeUnmount(() => {
  engine?.destroy();
  engine = null;
  emit('engine', null);
  metrics.destroyEngine();
});
</script>

<template>
  <div
    ref="container"
    :class="DEMO_TEXT.viewport"
    :style="DEMO_GEOMETRY.viewport"
    data-demo-container=""
    :aria-label="DEMO_TEXT.viewportLabel"
  />
  <Teleport v-for="cell in cells" :key="cell.key" :to="cell.host">
    <Cell :item="cell.item" :position="cell.position" />
  </Teleport>
</template>
