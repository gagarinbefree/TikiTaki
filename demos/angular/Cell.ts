import { Component, computed, input, type OnInit, type OnDestroy } from '@angular/core';
import type { Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { cellAppearance } from '../shared';
import { metrics } from './metrics';

/** Render a cell label in a native Angular component. */
@Component({ selector: 'tikitaki-angular-cell', standalone: true, templateUrl: './Cell.component.html', host: { class: 'd-block h-100' } })
export class Cell implements OnInit, OnDestroy {
  readonly fullscreen = input(false);
  readonly item = input.required<string>();
  readonly position = input.required<Position>();
  readonly appearance = computed(() => cellAppearance(this.position(), this.fullscreen()));
  readonly text = DEMO_TEXT;
  readonly geometry = DEMO_GEOMETRY;
  /**
   * ngOnInit
   *
   * Count each component mount for browser lifecycle verification.
   */
  ngOnInit() {
    metrics.mount();
  }
  /**
   * ngOnDestroy
   *
   * Pair every mount with cleanup under the owning view.
   */
  ngOnDestroy() {
    metrics.unmount();
  }
}
