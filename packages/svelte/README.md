# @tikitaki_gagarinbefree/svelte

Optional Svelte 5 adapter for TikiTaki. The core remains independent of Svelte.
Create one `createSvelteCellAdapter<T>()` per engine view and pass `bridge.adapter`
to `createSwipeEngine`. Subscribe to `bridge.cells` in a keyed template and apply
`use:portal={cell.host}` to a framework-owned wrapper around each cell component.

The bridge exposes a readonly Svelte store of frozen snapshots. Surviving cells
retain their key, host, context, and component state when data changes. Removed
cells leave the keyed template and release their component lifecycle. The portal
action moves only its owned wrapper, cleans up idempotently, and never creates
per-cell Svelte roots. The engine owns host elements; Svelte owns their descendants.

Create the DOM engine in `onMount`, forward grid changes with `$effect`, and destroy
it in the mount cleanup. Keep mutable controller resources outside deep proxies.
See the [working demo](../../demos/svelte/EngineView.svelte) for complete ownership,
reactive updates, parent context, and teardown. Use `tick()` before asserting
framework content after engine operations.
