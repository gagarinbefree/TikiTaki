import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';
import { createSwipeEngine } from 'tikitaki/dom';
import { DEMO_TEXT, DEMO_GEOMETRY } from '../config';
import { initialGrid, INITIAL_POSITION, createMetrics } from '../shared';
import { showRepositoryLink } from '../version';
import { createLitCellAdapter } from './cell';
import { renderCellMap } from './cell-map';
import type { Direction, Grid, Position } from 'tikitaki';
import type { SwipeEngine } from 'tikitaki/dom';

/** Require an existing element from the static demo template. */
function requireElement(selector: string) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(DEMO_TEXT.missingDemoRoot);
  return element;
}

const column = requireElement('[data-viewport-column]');
const map = requireElement('[data-cell-map]');
const rows = requireElement('[data-map-rows]');
Object.assign(column.style, DEMO_GEOMETRY.phoneColumn);
Object.assign(map.style, DEMO_GEOMETRY.map);
const metrics = createMetrics();
let grid: Grid<string> = initialGrid;
let position = INITIAL_POSITION;
let engine: SwipeEngine<string> | null = null;

const adapter = createLitCellAdapter(metrics);

/** Update the Lit map after navigation, data replacement, or lifecycle changes. */
function renderMap(): void {
  renderCellMap(rows, {
    grid,
    position,
    enabled: engine !== null,
    onSelect: (target) => {
      void engine?.goTo(target).catch(metrics.error);
    },
  });
}

/** Mount one independently owned engine into the portrait viewport. */
function mount() {
  const container = document.createElement('div');
  container.className = DEMO_TEXT.viewport;
  Object.assign(container.style, DEMO_GEOMETRY.viewport);
  container.setAttribute(DEMO_TEXT.dataDemoContainer, DEMO_TEXT.empty);
  container.setAttribute(DEMO_TEXT.ariaLabel, DEMO_TEXT.viewportLabel);
  column.replaceChildren(container);
  engine = createSwipeEngine({
    container,
    grid,
    initialPosition: INITIAL_POSITION,
    adapter,
    onPositionChange(next) {
      position = next;
      renderMap();
    },
    onError: metrics.error,
  });
  metrics.createEngine();
  renderMap();
}

/** Release the engine before removing its viewport; repeated cleanup is safe. */
function unmount() {
  if (engine === null) return;
  engine.destroy();
  engine = null;
  metrics.destroyEngine();
  column.replaceChildren();
  renderMap();
}

/** Replace demo data through the public API and reflect clamped coordinates. */
function updateGrid(next: Grid<string>) {
  grid = next;
  engine?.updateGrid(grid);
  position = engine?.getPosition() ?? INITIAL_POSITION;
  renderMap();
}

mount();
window.tikitakiDemo.commands = {
  /** Request one animated transition through the public API. */
  navigate: (direction: Direction) => {
    void engine?.navigate(direction).catch(metrics.error);
  },
  /** Jump to a valid cell through the public API. */
  goTo: (target: Position) => {
    void engine?.goTo(target).catch(metrics.error);
  },
  update: () => {
    updateGrid(grid.map((row) => row.map((item) => item + DEMO_TEXT.updateSuffix)));
  },
  shrink: () => {
    updateGrid([[DEMO_TEXT.only]]);
  },
  toggle: () => {
    if (engine !== null) unmount();
    else {
      grid = initialGrid;
      position = INITIAL_POSITION;
      mount();
    }
  },
};
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  unmount();
  window.tikitakiDemo.commands = null;
});
showRepositoryLink();
