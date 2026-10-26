import { assert, expect, it } from 'vitest';
import { createGestureEngine, createNavigationModel, type NavigationModel } from '../src/index';
import type { Direction, GestureContext } from '../src/index';
/**
 * context
 * @param model The model argument.
 * @returns The viewport dimensions and available neighboring directions.
 */
function context(model: NavigationModel<string>): GestureContext {
  const result: GestureContext = {
    width: 300,
    height: 600,
    neighbors: {
      up: model.getNeighbor('up') !== null,
      down: model.getNeighbor('down') !== null,
      left: model.getNeighbor('left') !== null,
      right: model.getNeighbor('right') !== null,
    },
  };

  return result;
}
/**
 * sample
 * @param x The x argument.
 * @param y The y argument.
 * @param time The time argument.
 * @returns The pointer coordinates, identifier, and timestamp.
 */
function sample(x: number, y: number, time: number) {
  const result = { pointerId: 1, x, y, time };

  return result;
}
it('connects gesture plans to ragged navigation with a single deferred commit', () => {
  const model = createNavigationModel<string>([['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'], ['B1'], ['C1', 'C2', 'C3']], {
    row: 0,
    col: 9,
  });
  const gesture = createGestureEngine(context(model));
  const vectors: Record<Direction, readonly [number, number]> = { up: [0, -10000], down: [0, 10000], left: [-10000, 0], right: [10000, 0] };
  /**
   * swipe
   * @param direction The requested navigation direction.
   * @param expectedItem The expected item argument.
   * @param expectedCommit The expected commit argument.
   */
  const swipe = (direction: Direction, expectedItem: string, expectedCommit: boolean) => {
    const before = model.getPosition();
    const [x, y] = vectors[direction];
    gesture.pointerDown(sample(0, 0, 0));
    gesture.pointerMove(sample(x, y, 1000));
    const plan = gesture.pointerUp(sample(x, y, 1100));
    assert(plan !== null);
    expect(model.getPosition()).toEqual(before);
    expect(plan.direction).toBe(expectedCommit ? direction : null);
    expect(gesture.pointerDown(sample(0, 0, 1200))).toBe(false);
    expect(gesture.pointerUp(sample(x, y, 1300))).toBeNull();
    if (gesture.finishSettling(plan) && plan.direction !== null) {
      expect(model.navigate(plan.direction)).toBe(true);
    }
    expect(gesture.finishSettling(plan)).toBe(false);
    gesture.updateContext(context(model));
    expect(model.getItem(model.getPosition())).toBe(expectedItem);
  };
  swipe('down', 'A10', false);
  expect(model.getPosition()).toEqual({ row: 0, col: 9 });
  swipe('up', 'B1', true);
  swipe('left', 'B1', false);
  swipe('right', 'B1', false);
  swipe('up', 'C1', true);
  swipe('left', 'C2', true);
  swipe('down', 'B1', true);
  swipe('down', 'A1', true);
});
it('grid replacement invalidates an in-flight plan and refreshes edge availability', () => {
  const model = createNavigationModel<string>([['A1', 'A2'], ['B1']], { row: 0, col: 1 });
  const gesture = createGestureEngine(context(model));
  gesture.pointerDown(sample(0, 0, 0));
  const plan = gesture.pointerUp(sample(0, -100, 1000));
  assert(plan !== null);
  model.updateGrid([['only']]);
  gesture.updateContext(context(model));
  expect(gesture.finishSettling(plan)).toBe(false);
  expect(model.getPosition()).toEqual({ row: 0, col: 0 });
  gesture.pointerDown(sample(0, 0, 0));
  expect(gesture.pointerUp(sample(0, -100, 20))?.direction).toBeNull();
  expect(model.getItem(model.getPosition())).toBe('only');
});
