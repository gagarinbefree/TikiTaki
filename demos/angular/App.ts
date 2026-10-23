import { Component, DestroyRef, inject, signal } from '@angular/core';
import type { Grid, Position } from 'tikitaki';
import type { SwipeEngine } from 'tikitaki/dom';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { initialGrid, INITIAL_POSITION } from '../shared';
import { EngineView } from './EngineView';
import { CellMap } from './CellMap';
import { DEMO_CONTEXT } from './context';
import { metrics } from './metrics';

/** Coordinate native Angular signals, template views, and demo lifecycle diagnostics. */
@Component({
  selector: 'tikitaki-angular-app',
  standalone: true,
  imports: [EngineView, CellMap],
  providers: [{ provide: DEMO_CONTEXT, useValue: DEMO_TEXT.angularContext }],
  templateUrl: './App.component.html',
  host: { class: 'd-block' },
})
export default class App {
  readonly text = DEMO_TEXT;
  readonly geometry = DEMO_GEOMETRY;
  readonly grid = signal<Grid<string>>(initialGrid);
  readonly visible = signal(true);
  readonly position = signal<Position>(INITIAL_POSITION);
  readonly engine = signal<SwipeEngine<string> | null>(null);
  readonly receiveEngine = (engine: SwipeEngine<string> | null) => {
    this.engine.set(engine);
  };
  /** Pair framework lifecycle ownership with the controller and its diagnostics. */
  constructor() {
    window.tikitakiDemo.commands = {
      navigate: (direction) => {
        void this.engine()?.navigate(direction).catch(metrics.error);
      },
      goTo: (target) => {
        this.select(target);
      },
      update: () => {
        this.grid.update((grid) => grid.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix)));
      },
      shrink: () => {
        this.grid.set([[DEMO_TEXT.only]]);
      },
      toggle: () => {
        this.remount();
      },
    };
    inject(DestroyRef).onDestroy(() => {
      window.tikitakiDemo.commands = null;
    });
  }
  /** Select a map cell and report controller failures. */
  select(position: Position) {
    void this.engine()?.goTo(position).catch(metrics.error);
  }
  /** Reset initial data before creating another independent controller. */
  remount() {
    if (!this.visible()) {
      this.grid.set(initialGrid);
      this.position.set(INITIAL_POSITION);
    }
    this.visible.update((visible) => !visible);
  }
}
