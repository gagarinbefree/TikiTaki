<script setup lang="ts">
import { computed } from 'vue';
import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { cellMapRows, type CellMapProps } from '../shared';
import type { Position } from 'tikitaki';

const props = defineProps<Omit<CellMapProps, 'onSelect'>>();
const emit = defineEmits<{ select: [position: Position] }>();
const rows = computed(() => cellMapRows(props));
</script>

<template>
  <nav :style="DEMO_GEOMETRY.map" :class="DEMO_TEXT.gridMap" :aria-label="DEMO_TEXT.cellMapTitle">
    <div :class="DEMO_TEXT.gridMapHeader">
      <span :class="DEMO_TEXT.gridMapLegend">{{ DEMO_TEXT.currentCellLegend }}</span>
    </div>
    <p :class="DEMO_TEXT.hint">{{ DEMO_TEXT.cellMapHint }}</p>
    <div :class="DEMO_TEXT.gridMapScroll" :style="DEMO_GEOMETRY.mapRows">
      <p
        v-for="(cells, row) in rows"
        :key="row"
        :class="DEMO_TEXT.gridMapRow"
        :style="DEMO_GEOMETRY.mapRow"
        :data-map-row="row"
        role="group"
        :aria-label="DEMO_LABELS.row(row)"
      >
        <button
          v-for="cell in cells"
          :key="cell.position.col"
          type="button"
          :class="cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell"
          :style="{ ...DEMO_GEOMETRY.mapCell, ...(cell.current ? DEMO_GEOMETRY.mapCurrentCell : {}) }"
          :disabled="!enabled"
          :title="DEMO_LABELS.coordinates(cell.position)"
          :aria-current="cell.current ? true : undefined"
          @click="emit('select', cell.position)"
        >
          {{ cell.label }}
        </button>
      </p>
    </div>
  </nav>
</template>
