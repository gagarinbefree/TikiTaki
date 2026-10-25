<script setup lang="ts">
import { computed } from 'vue';
import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY, MOBILE_LAYOUT } from '../config';
import { cellMapRows, type CellMapProps } from '../shared';
import type { Position } from 'tikitaki';

const props = defineProps<Omit<CellMapProps, 'onSelect'> & { readonly fullscreen: boolean }>();
const emit = defineEmits<{ select: [position: Position] }>();
const rows = computed(() => cellMapRows(props));
</script>

<template>
  <nav
    :style="fullscreen ? MOBILE_LAYOUT.mapGeometry : DEMO_GEOMETRY.map"
    :class="fullscreen ? MOBILE_LAYOUT.map : DEMO_TEXT.gridMap"
    :aria-label="DEMO_TEXT.cellMapTitle"
  >
    <div v-if="!fullscreen" :class="DEMO_TEXT.gridMapHeader">
      <span :class="DEMO_TEXT.gridMapLegend">{{ DEMO_TEXT.currentCellLegend }}</span>
    </div>
    <p v-if="!fullscreen" :class="DEMO_TEXT.hint">{{ DEMO_TEXT.cellMapHint }}</p>
    <div :class="fullscreen ? MOBILE_LAYOUT.rows : DEMO_TEXT.gridMapScroll">
      <p
        v-for="(cells, row) in rows"
        :key="row"
        :class="fullscreen ? MOBILE_LAYOUT.row : DEMO_TEXT.gridMapRow"
        :data-map-row="row"
        role="group"
        :aria-label="DEMO_LABELS.row(row)"
      >
        <button
          v-for="cell in cells"
          :key="cell.position.col"
          type="button"
          :class="
            fullscreen
              ? cell.current
                ? MOBILE_LAYOUT.currentCell
                : MOBILE_LAYOUT.cell
              : cell.current
                ? DEMO_TEXT.gridMapCurrentCell
                : DEMO_TEXT.gridMapCell
          "
          :style="fullscreen && cell.current ? MOBILE_LAYOUT.currentCellGeometry : undefined"
          :data-bs-target="fullscreen ? '' : undefined"
          :disabled="!enabled"
          :title="DEMO_LABELS.coordinates(cell.position)"
          :aria-current="cell.current ? true : undefined"
          @click="emit('select', cell.position)"
        >
          <span :class="fullscreen ? MOBILE_LAYOUT.label : undefined">{{ cell.label }}</span>
        </button>
      </p>
    </div>
  </nav>
</template>
