<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import type { Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { cellAppearance } from '../shared';
import { metrics } from './metrics';

defineProps<{ readonly item: string; readonly position: Position }>();
onMounted(metrics.mount);
onUnmounted(metrics.unmount);
</script>

<template>
  <article :class="cellAppearance(position)" :style="DEMO_GEOMETRY.cell" :data-item="item" :data-row="position.row">
    <h1 :class="DEMO_TEXT.cellTitle">{{ item }}</h1>
  </article>
</template>
