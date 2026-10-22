// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import * as navigation from '../src/navigation';
import * as gesture from '../src/gesture';
import * as dom from '../src/dom';
import { frameworkEnvironment } from './helpers/framework-environment';

let environment: ReturnType<typeof frameworkEnvironment>;
let dispose: (() => void) | undefined;
beforeEach(() => {
  environment = frameworkEnvironment();
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  environment.restore();
  document.body.replaceChildren();
});

it('creates independent functional navigation models with detached operations', () => {
  const create = navigation.createNavigationModel;
  expect(create).toBeTypeOf('function');
  const first = create([['A1', 'A2'], ['B1']]);
  const second = create([['other']]);
  const { navigate, getPosition } = first;
  expect(navigate('left')).toBe(true);
  expect(navigate('up')).toBe(true);
  expect(getPosition()).toEqual({ row: 1, col: 0 });
  expect(second.getPosition()).toEqual({ row: 0, col: 0 });
});

it('creates a gesture state machine whose detached handlers preserve its own state', () => {
  const create = gesture.createGestureEngine;
  expect(create).toBeTypeOf('function');
  const engine = create({ width: 300, height: 600, neighbors: { up: true, down: false, left: false, right: false } });
  const { pointerDown, pointerUp, getSnapshot, destroy } = engine;
  dispose = destroy;
  expect(pointerDown({ pointerId: 1, x: 0, y: 0, time: 0 })).toBe(true);
  const plan = pointerUp({ pointerId: 1, x: 0, y: -100, time: 100 });
  expect(plan?.direction).toBe('up');
  expect(getSnapshot().state).toBe('settling');
  destroy();
  expect(getSnapshot().destroyed).toBe(true);
});

it('creates a renderer with detached lifecycle operations and no constructor', () => {
  const create = dom.createDOMRenderer;
  expect(create).toBeTypeOf('function');
  const container = document.createElement('div');
  document.body.append(container);
  const renderer = create<string>({
    container,
    navigation: navigation.createNavigationModel([['A1']]),
    adapter: dom.createDOMAdapter((item) => {
      const cell = document.createElement('div');
      cell.textContent = item;

      return cell;

    }),
  });
  const { getSize, reset, destroy } = renderer;
  dispose = destroy;
  expect(getSize()).toEqual({ width: 300, height: 600 });
  reset();
  destroy();
  destroy();
  expect(container.children).toHaveLength(0);
});

it('creates a swipe controller with detached commands and terminal cleanup', async () => {
  const create = dom.createSwipeEngine;
  expect(create).toBeTypeOf('function');
  const container = document.createElement('div');
  document.body.append(container);
  const engine = create({
    container,
    grid: [['A1', 'A2'], ['B1']],
    renderCell(item) {
      const element = document.createElement('div');
      element.textContent = item;

      return element;

    },
  });
  const { navigate, getPosition, destroy } = engine;
  dispose = destroy;
  const transition = navigate('up');
  await environment.finish();
  expect(await transition).toBe(true);
  expect(getPosition()).toEqual({ row: 1, col: 0 });
  destroy();
  expect(await navigate('down')).toBe(false);
});
