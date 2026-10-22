import { expect, it } from 'vitest';
import { createNavigationModel } from '../src/navigation';

it('follows A10 → B1 → C1 → C2 → B1 → A1 without remembering columns', () => {
  const grid = [['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'], ['B1'], ['C1', 'C2', 'C3']] as const;
  const model = createNavigationModel<string>(grid, { row: 0, col: 9 });
  const independent = createNavigationModel(grid, { row: 2, col: 2 });

  expect(model.navigate('down')).toBe(false);
  expect(model.getItem(model.getPosition())).toBe('A10');
  for (const [direction, item] of [
    ['up', 'B1'],
    ['up', 'C1'],
    ['left', 'C2'],
    ['down', 'B1'],
    ['down', 'A1'],
  ] as const) {
    expect(model.navigate(direction)).toBe(true);
    expect(model.getItem(model.getPosition())).toBe(item);
    if (item === 'B1') {
      expect(model.navigate('left')).toBe(false);
      expect(model.navigate('right')).toBe(false);
      expect(model.getPosition()).toEqual({ row: 1, col: 0 });
    }
  }
  model.updateGrid([['replacement']]);
  expect(model.getPosition()).toEqual({ row: 0, col: 0 });
  expect(independent.getPosition()).toEqual({ row: 2, col: 2 });
  expect(independent.getItem(independent.getPosition())).toBe('C3');
});
