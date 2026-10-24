import { Component, computed, input, output } from '@angular/core';
import type { Grid, Position } from 'tikitaki';
import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { cellMapRows } from '../shared';

/** Render the same accessible ragged cell map using Angular template control flow. */
@Component({
  selector: 'nav[tikitakiAngularMap]',
  standalone: true,
  templateUrl: './CellMap.component.html',
  host: {
    '[class]': 'text.gridMap',
    '[attr.aria-label]': 'text.cellMapTitle',
    '[style.position]': 'geometry.map.position',
    '[style.bottom]': 'geometry.map.bottom',
    '[style.left]': 'geometry.map.left',
    '[style.transform]': 'geometry.map.transform',
    '[style.z-index]': 'geometry.map.zIndex',
    '[style.width]': 'geometry.map.width',
    '[style.max-width]': 'geometry.map.maxWidth',
    '[style.padding]': 'geometry.map.padding',
    '[style.background-color]': 'geometry.map.backgroundColor',
    '[style.border-width]': 'geometry.map.borderWidth',
    '[style.min-width]': 'geometry.map.minWidth',
    '[style.min-height]': 'geometry.map.minHeight',
  },
})
export class CellMap {
  readonly grid = input.required<Grid<string>>();
  readonly position = input.required<Position>();
  readonly enabled = input(true);
  readonly selectCell = output<Position>();
  readonly text = DEMO_TEXT;
  readonly labels = DEMO_LABELS;
  readonly geometry = DEMO_GEOMETRY;
  readonly rows = computed(() => cellMapRows({ grid: this.grid(), position: this.position(), enabled: this.enabled() }));
}
