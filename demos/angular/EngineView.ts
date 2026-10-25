import {
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { createAngularCellAdapter, type AngularCellContext } from '@tikitaki_gagarinbefree/angular';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import type { Grid, Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_GEOMETRY, MOBILE_LAYOUT } from '../config';
import { INITIAL_POSITION } from '../shared';
import { Cell } from './Cell';
import { metrics } from './metrics';

/** Own one controller and its parent-attached Angular embedded views. */
@Component({
  selector: 'tikitaki-angular-view',
  standalone: true,
  imports: [Cell],
  templateUrl: './EngineView.component.html',
  host: { class: 'd-block' },
})
export class EngineView {
  readonly fullscreen = input(false);
  readonly mobileLayout = MOBILE_LAYOUT;
  readonly grid = input.required<Grid<string>>();
  readonly positionChange = output<Position>();
  readonly onengine = input.required<(engine: SwipeEngine<string> | null) => void>();
  readonly text = DEMO_TEXT;
  readonly geometry = DEMO_GEOMETRY;
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly template = viewChild.required<TemplateRef<AngularCellContext<string>>>('cell');
  private readonly views = inject(ViewContainerRef);
  private engine: SwipeEngine<string> | null = null;
  /** Pair framework lifecycle ownership with the controller and its diagnostics. */
  constructor() {
    afterNextRender(() => {
      const adapter = createAngularCellAdapter<string>((context) => this.views.createEmbeddedView(this.template(), context));
      this.engine = createSwipeEngine({
        container: this.container().nativeElement,
        grid: this.grid(),
        initialPosition: INITIAL_POSITION,
        adapter,
        onPositionChange: (next) => {
          this.positionChange.emit(next);
        },
        onError: metrics.error,
      });
      metrics.createEngine();
      this.onengine()(this.engine);
    });
    effect(() => {
      const grid = this.grid();
      this.engine?.updateGrid(grid);
    });
    inject(DestroyRef).onDestroy(() => {
      if (!this.engine) return;
      this.engine.destroy();
      this.engine = null;
      this.onengine()(null);
      metrics.destroyEngine();
    });
  }
}
