import { assert, describe, expect, it } from 'vitest';
import { createNavigationModel } from '../src/navigation';
import type { Direction, Grid, Position } from '../src/navigation';

const grid = [
  ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'],
  ['B1'],
  ['C1', 'C2', 'C3'],
  ['D1', 'D2', 'D3', 'D4', 'D5'],
] as const;

describe('NavigationModel', () => {
  it('starts at the first cell by default', () => {
    const model = createNavigationModel(grid);
    expect(model.getPosition()).toEqual({ row: 0, col: 0 });
    expect(model.getItem(model.getPosition())).toBe('A1');
  });

  const cases: [string, Position, Direction, Position | null][] = [
    ['up from A10', { row: 0, col: 9 }, 'up', { row: 1, col: 0 }],
    ['down from C3', { row: 2, col: 2 }, 'down', { row: 1, col: 0 }],
    ['up from C3', { row: 2, col: 2 }, 'up', { row: 3, col: 0 }],
    ['down from D5', { row: 3, col: 4 }, 'down', { row: 2, col: 0 }],
    ['left from A1', { row: 0, col: 0 }, 'left', { row: 0, col: 1 }],
    ['right from A10', { row: 0, col: 9 }, 'right', { row: 0, col: 8 }],
    ['left from C2', { row: 2, col: 1 }, 'left', { row: 2, col: 2 }],
    ['right from C2', { row: 2, col: 1 }, 'right', { row: 2, col: 0 }],
    ['top at A10 preserves col', { row: 0, col: 9 }, 'down', null],
    ['bottom at D5 preserves col', { row: 3, col: 4 }, 'up', null],
    ['left edge', { row: 0, col: 0 }, 'right', null],
    ['right edge', { row: 0, col: 9 }, 'left', null],
    ['single-cell row left', { row: 1, col: 0 }, 'left', null],
    ['single-cell row right', { row: 1, col: 0 }, 'right', null],
  ];

  it.each(cases)('%s', (_name, initial, direction, target) => {
    const model = createNavigationModel(grid, initial);
    expect(model.getNeighbor(direction)).toEqual(target);
    expect(model.getPosition()).toEqual(initial);
    expect(model.navigate(direction)).toBe(target !== null);
    expect(model.getPosition()).toEqual(target ?? initial);
    expect(model.getNeighbor(direction)).not.toBeUndefined();
  });

  for (const [row, cells] of grid.entries()) {
    for (const col of cells.keys()) {
      it(`uses col 0 for every successful vertical move from (${String(row)}, ${String(col)})`, () => {
        for (const direction of ['up', 'down'] as const) {
          const model = createNavigationModel(grid, { row, col });
          const nextRow = direction === 'up' ? row + 1 : row - 1;
          const possible = nextRow >= 0 && nextRow < grid.length;
          expect(model.navigate(direction)).toBe(possible);
          expect(model.getPosition()).toEqual(possible ? { row: nextRow, col: 0 } : { row, col });
        }
      });
    }
  }

  it.each<Direction>(['up', 'down', 'left', 'right'])('cannot leave a one-cell grid in direction %s', (direction) => {
    const model = createNavigationModel([['only']]);
    expect(model.getNeighbor(direction)).toBeNull();
    expect(model.navigate(direction)).toBe(false);
    expect(model.getPosition()).toEqual({ row: 0, col: 0 });
  });

  it('goTo can jump to a valid cell and reports whether the position changed', () => {
    const model = createNavigationModel(grid);
    expect(model.goTo({ row: 3, col: 4 })).toBe(true);
    expect(model.getPosition()).toEqual({ row: 3, col: 4 });
    expect(model.goTo({ row: 3, col: 4 })).toBe(false);
  });

  it('reads an arbitrary cell without moving', () => {
    const model = createNavigationModel(grid);
    expect(model.getItem({ row: 2, col: 2 })).toBe('C3');
    expect(model.getPosition()).toEqual({ row: 0, col: 0 });
  });

  it('snapshots caller-owned arrays and positions without freezing cell content', () => {
    const item = { label: 'A1' };
    const row = [item, { label: 'A2' }];
    const input = [row];
    const initial = { row: 0, col: 1 };
    const model = createNavigationModel(input, initial);
    initial.col = 0;
    row.pop();
    input.length = 0;
    expect(model.getPosition()).toEqual({ row: 0, col: 1 });
    expect(model.getItem({ row: 0, col: 1 })).toEqual({ label: 'A2' });
    expect(model.getItem({ row: 0, col: 0 })).toBe(item);
    expect(Object.isFrozen(item)).toBe(false);
    item.label = 'updated';
    expect(model.getItem({ row: 0, col: 0 }).label).toBe('updated');
  });

  it('returns immutable positions and neighbors without exposing mutable state', () => {
    const model = createNavigationModel(grid);
    const position = model.getPosition();
    const neighbor = model.getNeighbor('up');
    assert(neighbor !== null);
    expect(Object.isFrozen(position)).toBe(true);
    expect(Object.isFrozen(neighbor)).toBe(true);
    expect(() => Object.assign(position, { col: 9 })).toThrow(TypeError);
    expect(() => Object.assign(neighbor, { col: 9 })).toThrow(TypeError);
    model.navigate('left');
    expect(position).toEqual({ row: 0, col: 0 });
    expect(model.getPosition()).toEqual({ row: 0, col: 1 });
  });

  it('accepts undefined and arbitrary objects as cell content', () => {
    const model = createNavigationModel([[undefined, null, { id: 1 }]]);
    expect(model.getItem({ row: 0, col: 0 })).toBeUndefined();
    expect(model.getItem({ row: 0, col: 1 })).toBeNull();
    expect(model.getItem({ row: 0, col: 2 })).toEqual({ id: 1 });
  });

  describe('runtime validation', () => {
    const invalidShapes: unknown[] = [
      null,
      undefined,
      {},
      'grid',
      [null],
      [{}],
      [['valid'], null],
      new Array<unknown>(1),
      [new Array<unknown>(1)],
    ];

    it.each(invalidShapes.map((value) => [value]))('rejects malformed grid %j', (input) => {
      expect(() => createNavigationModel(input as Grid<unknown>)).toThrow(TypeError);
    });

    it.each([[], [[]], [['valid'], []]].map((value) => [value]))('rejects empty grid/row %j', (input) => {
      expect(() => createNavigationModel(input as Grid<unknown>)).toThrow(RangeError);
    });

    const malformedPositions: unknown[] = [null, {}, { row: 0 }, '0,0'];
    it.each(malformedPositions.map((value) => [value]))('rejects malformed position %j in every entry point', (input) => {
      const position = input as Position;
      const model = createNavigationModel(grid, { row: 2, col: 1 });
      expect(() => createNavigationModel(grid, position)).toThrow(TypeError);
      expect(() => model.goTo(position)).toThrow(TypeError);
      expect(() => model.getItem(position)).toThrow(TypeError);
      expect(model.getPosition()).toEqual({ row: 2, col: 1 });
    });

    const invalidCoordinates: Position[] = [
      { row: -1, col: 0 },
      { row: 0, col: -1 },
      { row: 0.5, col: 0 },
      { row: 0, col: 0.5 },
      { row: NaN, col: 0 },
      { row: 0, col: Infinity },
      { row: Number.MAX_SAFE_INTEGER + 1, col: 0 },
      { row: 4, col: 0 },
      { row: 1, col: 1 },
      { row: 0, col: 10 },
    ];
    it.each(invalidCoordinates)('rejects out-of-range position %j', (position) => {
      const model = createNavigationModel(grid, { row: 2, col: 1 });
      expect(() => createNavigationModel(grid, position)).toThrow(RangeError);
      expect(() => model.goTo(position)).toThrow(RangeError);
      expect(() => model.getItem(position)).toThrow(RangeError);
      expect(model.getPosition()).toEqual({ row: 2, col: 1 });
    });

    it.each([null, undefined, 'diagonal', 0])('rejects direction %j', (input) => {
      const model = createNavigationModel(grid, { row: 0, col: 9 });
      expect(() => model.navigate(input as Direction)).toThrow(TypeError);
      expect(() => model.getNeighbor(input as Direction)).toThrow(TypeError);
      expect(model.getPosition()).toEqual({ row: 0, col: 9 });
    });
  });

  describe('updateGrid', () => {
    it('preserves a position still valid in the replacement grid', () => {
      const model = createNavigationModel<string>(grid, { row: 2, col: 1 });
      model.updateGrid([['X1'], ['Y1'], ['Z1', 'Z2']]);
      expect(model.getPosition()).toEqual({ row: 2, col: 1 });
      expect(model.getItem(model.getPosition())).toBe('Z2');
      expect(model.getNeighbor('up')).toBeNull();
    });

    it('clamps a removed column to the last remaining column', () => {
      const model = createNavigationModel<string>(grid, { row: 0, col: 9 });
      model.updateGrid([['X1', 'X2'], ['Y1']]);
      expect(model.getPosition()).toEqual({ row: 0, col: 1 });
      expect(model.getNeighbor('up')).toEqual({ row: 1, col: 0 });
    });

    it('clamps a removed row and then its column', () => {
      const model = createNavigationModel<string>(grid, { row: 3, col: 4 });
      model.updateGrid([['X1'], ['Y1', 'Y2']]);
      expect(model.getPosition()).toEqual({ row: 1, col: 1 });
      model.updateGrid([['only']]);
      expect(model.getPosition()).toEqual({ row: 0, col: 0 });
      expect(model.getItem(model.getPosition())).toBe('only');
    });

    it('keeps the column when a removed row maps to a sufficiently long row', () => {
      const model = createNavigationModel<string>(grid, { row: 3, col: 4 });
      model.updateGrid([['X1', 'X2', 'X3', 'X4', 'X5', 'X6']]);
      expect(model.getPosition()).toEqual({ row: 0, col: 4 });
    });

    it('copies the replacement structure', () => {
      const model = createNavigationModel<string>(grid);
      const row = ['X1', 'X2'];
      const replacement = [row];
      model.updateGrid(replacement);
      row.length = 0;
      replacement.length = 0;
      expect(model.navigate('left')).toBe(true);
      expect(model.getItem(model.getPosition())).toBe('X2');
    });

    it.each([[], [[]], [['valid'], []], null, [null]].map((value) => [value]))('rejects replacement %j atomically', (input) => {
      const model = createNavigationModel<string>(grid, { row: 0, col: 9 });
      expect(() => {
        model.updateGrid(input as Grid<string>);
      }).toThrow();
      expect(model.getPosition()).toEqual({ row: 0, col: 9 });
      expect(model.getItem(model.getPosition())).toBe('A10');
      expect(model.navigate('up')).toBe(true);
      expect(model.getItem(model.getPosition())).toBe('B1');
    });
  });
});
