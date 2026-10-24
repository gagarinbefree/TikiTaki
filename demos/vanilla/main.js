// @ts-check
import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';
import { createSwipeEngine, createDOMAdapter } from 'tikitaki/dom';
import { DEMO_TEXT, DEMO_LABELS, DEMO_GEOMETRY } from '../config';
import { initialGrid, INITIAL_POSITION, cellAppearance, cellMapRows, createMetrics } from '../shared';
import { showRepositoryLink } from '../version';

/** Require an existing element from the static demo template. @param {string} selector */
function requireElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error(DEMO_TEXT.missingDemoRoot);
  return element;
}

const column = requireElement('[data-viewport-column]');
const map = requireElement('[data-cell-map]');
const rows = requireElement('[data-map-rows]');
Object.assign(column.style, DEMO_GEOMETRY.phoneColumn);
Object.assign(map.style, DEMO_GEOMETRY.map);
Object.assign(rows.style, DEMO_GEOMETRY.mapRows);
const metrics = createMetrics();
let grid = initialGrid;
let position = INITIAL_POSITION;
/** @type {import('tikitaki/dom').SwipeEngine<string> | null} */
let engine = null;

/** Render an ordinary DOM cell without a framework. @param {string} item @param {import('tikitaki').Position} coordinates */
function renderCell(item, coordinates) {
  const cell = document.createElement('article');
  cell.className = cellAppearance(coordinates);
  Object.assign(cell.style, DEMO_GEOMETRY.cell);
  cell.setAttribute(DEMO_TEXT.dataItem, item);
  cell.setAttribute(DEMO_TEXT.dataRow, String(coordinates.row));
  const title = document.createElement('h1');
  title.className = DEMO_TEXT.cellTitle;
  title.textContent = item;
  cell.append(title);
  return cell;
}

const dom = createDOMAdapter(renderCell);
/** Track owned DOM hosts so cleanup can be checked alongside the framework demos. @type {import('tikitaki/dom').CellAdapter<string>} */
const adapter = {
  mount(host, item, coordinates) {
    const mounted = dom.mount(host, item, coordinates);
    let released = false;
    metrics.mount();
    return {
      update: mounted.update,
      unmount() {
        if (released) return;
        released = true;
        mounted.unmount();
        metrics.unmount();
      },
    };
  },
};

/** Refresh map labels, selection, and disabled state from the committed engine state. */
function renderMap() {
  rows.replaceChildren();
  for (const [row, cells] of cellMapRows({ grid, position, enabled: engine !== null }).entries()) {
    const group = document.createElement('p');
    group.className = DEMO_TEXT.gridMapRow;
    Object.assign(group.style, DEMO_GEOMETRY.mapRow);
    group.setAttribute(DEMO_TEXT.dataMapRow, String(row));
    group.setAttribute('role', DEMO_TEXT.group);
    group.setAttribute(DEMO_TEXT.ariaLabel, DEMO_LABELS.row(row));
    for (const cell of cells) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = cell.current ? DEMO_TEXT.gridMapCurrentCell : DEMO_TEXT.gridMapCell;
      button.textContent = cell.label;
      Object.assign(button.style, DEMO_GEOMETRY.mapCell, cell.current ? DEMO_GEOMETRY.mapCurrentCell : {});
      button.title = DEMO_LABELS.coordinates(cell.position);
      button.disabled = engine === null;
      if (cell.current) button.setAttribute(DEMO_TEXT.ariaCurrent, DEMO_TEXT.true);
      button.addEventListener('click', () => {
        void engine?.goTo(cell.position).catch(metrics.error);
      });
      group.append(button);
    }
    rows.append(group);
  }
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

/** Replace demo data through the public API and reflect clamped coordinates. @param {import('tikitaki').Grid<string>} next */
function updateGrid(next) {
  grid = next;
  engine?.updateGrid(grid);
  position = engine?.getPosition() ?? INITIAL_POSITION;
  renderMap();
}

mount();
window.tikitakiDemo.commands = {
  /** @param {import('tikitaki').Direction} direction */
  navigate: (direction) => {
    void engine?.navigate(direction).catch(metrics.error);
  },
  /** @param {import('tikitaki').Position} target */
  goTo: (target) => {
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
showRepositoryLink(true);
