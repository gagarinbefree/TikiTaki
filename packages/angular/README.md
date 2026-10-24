# @tikitaki_gagarinbefree/angular

Optional Angular 21 adapter for TikiTaki. Angular is a peer dependency of this
package and is not a dependency of the core. The adapter itself is a functional
factory; Angular demo components use the framework's native standalone classes.

Pass a factory for a parent-owned embedded view:

```ts
const adapter = createAngularCellAdapter<string>((context) => views.createEmbeddedView(template, context));
const engine = createSwipeEngine({ container, grid, adapter });
```

The template receives the item as `$implicit` and its readonly coordinates as
`position`. The adapter moves the view's root nodes into the managed host.
Surviving views retain component identity and injector context during updates.
Updates change the context and run change detection. Unmount destroys the view
once and removes only its owned nodes; stale updates are ignored.

Create the controller after the container and template exist, forward signal
changes with `effect`, and destroy it through `DestroyRef`. Supply a factory
using `ViewContainerRef.createEmbeddedView` so the view remains attached to the
parent application's lifecycle. Never bootstrap a separate application per cell.
See the [working example](../../demos/angular/EngineView.ts).

The demo is zoneless and compiled ahead of time with Angular's `ngc` compiler.
Vite applies the official Angular library linker to dependencies in development
and production. The browser bundle does not include the JIT compiler. Run
`npm run demo` or `npm run demo:build`; both compile the Angular demo first.
