<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from 'vue';
import type { Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { metrics } from './metrics';

defineProps<{ readonly item: string; readonly position: Position }>();
const context = inject<string>(DEMO_TEXT.context, DEMO_TEXT.empty);
const count = ref(0);
onMounted(metrics.mount);
onUnmounted(metrics.unmount);
</script>

<template>
  <article :class="DEMO_TEXT.cell" :style="DEMO_GEOMETRY.cell" :data-item="item" :data-row="position.row">
    <small>{{ context }}</small>
    <h1 :class="DEMO_TEXT.cellTitle">{{ item }}</h1>
    <p>{{ DEMO_TEXT.swipeHint }}</p>
    <button :data-action="DEMO_TEXT.count" :class="DEMO_TEXT.buttonPrimary" @click="count++">{{ DEMO_LABELS.counter(count) }}</button>
  </article>
</template>
