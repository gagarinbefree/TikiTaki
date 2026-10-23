<script setup lang="ts">
import { provide, ref, shallowRef } from 'vue';
import type { Direction, Grid, Position } from 'tikitaki';
import type { SwipeEngine } from 'tikitaki/dom';
import { DEMO_TEXT, DEMO_LABELS } from '../config';
import { controls, hasNavigationTarget, initialGrid, INITIAL_POSITION, NAVIGATION_TARGET_POSITION } from '../shared';
import EngineView from './EngineView.vue';
import CellMap from './CellMap.vue';
import { metrics } from './metrics';

const grid = shallowRef<Grid<string>>(initialGrid);
const visible = ref(true);
const position = shallowRef<Position>(INITIAL_POSITION);
const engine = shallowRef<SwipeEngine<string> | null>(null);
provide(DEMO_TEXT.context, DEMO_TEXT.vueContextCompositionAPI);

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
</script>

<template>
  <main :class="DEMO_TEXT.container">
    <a :href="DEMO_TEXT.homePath">{{ DEMO_TEXT.demos }}</a>
    <p>
      <span :class="DEMO_TEXT.badge">{{ DEMO_TEXT.tikiTakiVue3CompositionAPI }}</span>
    </p>
    <div :class="DEMO_TEXT.pageHeader">
      <h1>{{ DEMO_TEXT.headline }}</h1>
    </div>
    <p>{{ DEMO_TEXT.intro }}</p>
    <div :class="DEMO_TEXT.layout" data-demo-layout="">
      <div :class="DEMO_TEXT.viewportColumn">
        <h3>{{ DEMO_TEXT.liveTitle }}</h3>
        <EngineView v-if="visible" :grid="grid" @engine="engine = $event" @position="position = $event" />
        <p v-else data-unmounted="">{{ DEMO_TEXT.destroyedMessage }}</p>
      </div>
      <aside :class="DEMO_TEXT.controls">
        <div :class="DEMO_TEXT.panel">
          <h3>{{ DEMO_TEXT.controlsTitle }}</h3>
          <p>
            <output :class="DEMO_TEXT.positionLabel" data-position="">{{ DEMO_LABELS.coordinates(position) }}</output>
          </p>
          <p v-for="{ direction, label } in controls" :key="direction">
            <button :class="DEMO_TEXT.buttonDefault" :data-navigate="direction" :disabled="!visible" @click="navigate(direction)">
              {{ label }}
            </button>
          </p>
          <p>
            <button
              :data-action="DEMO_TEXT.goto"
              :class="DEMO_TEXT.buttonPrimary"
              :disabled="!visible || !hasNavigationTarget(grid)"
              @click="select(NAVIGATION_TARGET_POSITION)"
            >
              {{ DEMO_TEXT.goToTargetLabel }}
            </button>
          </p>
          <p>
            <button :data-action="DEMO_TEXT.update" :class="DEMO_TEXT.buttonSuccess" :disabled="!visible" @click="update">
              {{ DEMO_TEXT.updateLabel }}
            </button>
          </p>
          <p>
            <button
              :data-action="DEMO_TEXT.shrink"
              :class="DEMO_TEXT.buttonWarning"
              :disabled="!visible"
              @click="grid = [[DEMO_TEXT.only]]"
            >
              {{ DEMO_TEXT.shrinkLabel }}
            </button>
          </p>
          <p>
            <button :class="visible ? DEMO_TEXT.buttonDanger : DEMO_TEXT.buttonSuccess" :data-action="DEMO_TEXT.toggle" @click="remount">
              {{ visible ? DEMO_TEXT.destroyLabel : DEMO_TEXT.remountLabel }}
            </button>
          </p>
          <p :class="DEMO_TEXT.hint">{{ DEMO_TEXT.counterHint }}</p>
        </div>
      </aside>
    </div>
    <hr />
    <CellMap :grid="grid" :position="position" :enabled="visible" @select="select" />
  </main>
</template>
