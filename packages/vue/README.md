# @tikitaki_gagarinbefree/vue

A functional Vue 3 adapter for TikiTaki. ESM, strict TypeScript, MIT licensed. Peer dependencies: the compatible `tikitaki` version declared in package.json and `vue@^3.5.44`. The core package has no Vue dependency.

## Usage

Create one bridge inside `<script setup>` and render its cells with `<Teleport>` in the same application. Teleport preserves provide/inject, application context, and component state. No per-cell applications are created.

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, shallowRef, watch } from 'vue';
import type { Grid } from 'tikitaki';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import { createVueCellAdapter } from '@tikitaki_gagarinbefree/vue';

const props = defineProps<{ readonly grid: Grid<string> }>();
const container = shallowRef<HTMLElement | null>(null);
const engine = shallowRef<SwipeEngine<string> | null>(null);
const bridge = createVueCellAdapter<string>();
const cells = bridge.cells;
onMounted(() => {
  if (!container.value) return;
  engine.value = createSwipeEngine({ container: container.value, grid: props.grid, adapter: bridge.adapter });
});
watch(
  () => props.grid,
  (grid) => engine.value?.updateGrid(grid),
);
onBeforeUnmount(() => {
  engine.value?.destroy();
  engine.value = null;
});
</script>

<template>
  <div ref="container" style="height: 100dvh" />
  <Teleport v-for="cell in cells" :key="cell.key" :to="cell.host">
    <button>{{ cell.item }}</button>
  </Teleport>
</template>
```

Keep the controller in `shallowRef`; deep proxying a stateful resource is unnecessary. Replace the grid array or call `updateGrid` explicitly. The bridge uses a readonly shallow ref of immutable snapshots, so hosts and user-owned items do not become proxies. Surviving hosts retain their keys; removed cells release their component lifecycle.

The framework owns host descendants. Keep framework children out of the managed container and render component content inside the template Teleports. Put hooks in child components. Supply container dimensions through application CSS and destroy the controller during cleanup.

Core promises synchronize hosts and adapter snapshots; await `nextTick` when asserting Vue content. Handle component failures through `onErrorCaptured` or the application's error handler and controller failures through promises or `onError`. Create the DOM controller on the client in `onMounted`. Ownership validation messages are centralized in `src/config.ts`.
