import { Component, inject, input, signal, type OnInit, type OnDestroy } from '@angular/core';
import type { Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { DEMO_CONTEXT } from './context';
import { metrics } from './metrics';

/** A native Angular component whose counter survives embedded-view data updates. */
@Component({ selector: 'tikitaki-angular-cell', standalone: true, templateUrl: './Cell.component.html', host: { class: 'd-block h-100' } })
export class Cell implements OnInit, OnDestroy {
  readonly item = input.required<string>();
  readonly position = input.required<Position>();
  readonly count = signal(0);
  readonly context = inject(DEMO_CONTEXT);
  readonly text = DEMO_TEXT;
  readonly labels = DEMO_LABELS;
  readonly geometry = DEMO_GEOMETRY;
  /** Count each component mount for browser lifecycle verification. */
  ngOnInit() {
    metrics.mount();
  }
  /** Pair every mount with cleanup under the owning view. */
  ngOnDestroy() {
    metrics.unmount();
  }
  /** Keep local state inside the Angular component. */
  increment() {
    this.count.update((value) => value + 1);
  }
}
