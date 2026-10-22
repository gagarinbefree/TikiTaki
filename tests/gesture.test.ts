import { assert, describe, expect, it } from 'vitest';
import { DEFAULT_GESTURE_OPTIONS, createGestureEngine } from '../src/gesture';
import type { GestureContext, GestureOptions, PointerSample } from '../src/gesture';
import type { Direction } from '../src/navigation';
function context(): GestureContext {
  const result: GestureContext = { width: 300, height: 600, neighbors: { up: true, down: true, left: true, right: true } };

  return result;

}
function point(x = 0, y = 0, time = 0, pointerId = 1): PointerSample {
  const result: PointerSample = { x, y, time, pointerId };

  return result;

}
describe('GestureEngine', () => {
  it('starts idle with immutable defaults and snapshots', () => {
    const engine = createGestureEngine(context());
    expect(engine.getSnapshot()).toEqual({ state: 'idle', axis: null, pointerId: null, offset: { x: 0, y: 0 }, destroyed: false });
    expect(engine.getOptions()).toEqual({
      distanceThreshold: 80,
      velocityThreshold: 0.5,
      axisLockThreshold: 8,
      animationDuration: 300,
      edgeResistance: 0.35,
    });
    expect(engine.getOptions()).toEqual(DEFAULT_GESTURE_OPTIONS);
    expect(Object.isFrozen(DEFAULT_GESTURE_OPTIONS)).toBe(true);
    expect(Object.isFrozen(engine.getOptions())).toBe(true);
    const snapshot = engine.getSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.offset)).toBe(true);
    expect(() => Object.assign(snapshot.offset, { x: 30 })).toThrow(TypeError);
    engine.pointerDown(point());
    expect(snapshot.state).toBe('idle');
    expect(engine.getSnapshot().state).toBe('tracking');
  });
  it('owns copies of options, context, and the starting pointer sample', () => {
    const input = { width: 300, height: 600, neighbors: { up: true, down: true, left: true, right: true } };
    const options = { distanceThreshold: 100 };
    const start = { x: 10, y: 20, time: 0, pointerId: 7 };
    const engine = createGestureEngine(input, options);
    engine.pointerDown(start);
    input.width = 50;
    input.neighbors.left = false;
    options.distanceThreshold = 1000;
    start.x = 999;
    expect(engine.pointerMove(point(-100, 20, 1000, 7))).toBe(true);
    expect(engine.getSnapshot().offset).toEqual({ x: -110, y: 0 });
    const plan = engine.pointerUp(point(-100, 20, 1100, 7));
    expect(plan?.direction).toBe('left');
    expect(plan?.to).toEqual({ x: -300, y: 0 });
    expect(engine.getOptions().distanceThreshold).toBe(100);
  });
  it('stays in the dead zone then locks at the configured threshold', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point(20, 30));
    expect(engine.pointerMove(point(27, 37, 10))).toBe(true);
    expect(engine.getSnapshot()).toMatchObject({ state: 'tracking', axis: null, offset: { x: 0, y: 0 } });
    engine.pointerMove(point(28, 31, 20));
    expect(engine.getSnapshot()).toMatchObject({ state: 'dragging', axis: 'x', offset: { x: 8, y: 0 } });
  });
  it('waits for a dominant axis on an exact diagonal and never switches axes', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-40, -40, 10));
    expect(engine.getSnapshot().state).toBe('tracking');
    engine.pointerMove(point(-41, -40, 20));
    engine.pointerMove(point(-50, -500, 30));
    expect(engine.getSnapshot()).toMatchObject({ axis: 'x', offset: { x: -50, y: 0 } });
    expect(engine.pointerUp(point(-100, -500, 1000))?.direction).toBe('left');
  });
  const directions: [Direction, number, number, 'x' | 'y', number, number][] = [
    ['left', -100, 0, 'x', -300, 0],
    ['right', 100, 0, 'x', 300, 0],
    ['up', 0, -100, 'y', 0, -600],
    ['down', 0, 100, 'y', 0, 600],
  ];
  it.each(directions)('produces one %s plan and waits for its completion', (direction, x, y, axis, endX, endY) => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(x, y, 1000));
    expect(engine.getSnapshot()).toMatchObject({ state: 'dragging', axis, offset: { x, y } });
    const plan = engine.pointerUp(point(x, y, 1100));
    assert(plan !== null);
    expect(plan).toEqual({ direction, from: { x, y }, to: { x: endX, y: endY }, duration: 300 });
    expect(engine.getSnapshot()).toMatchObject({ state: 'settling', pointerId: null, offset: { x, y } });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.from)).toBe(true);
    expect(Object.isFrozen(plan.to)).toBe(true);
    expect(engine.finishSettling(plan)).toBe(true);
    expect(engine.finishSettling(plan)).toBe(false);
    expect(engine.getSnapshot()).toMatchObject({ state: 'idle', axis: null, offset: { x: 0, y: 0 } });
  });
  it('includes the final pointerup coordinates even when there were no moves', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    expect(engine.pointerUp(point(-30, 0, 30))?.direction).toBe('left');
  });
  it('returns directly to idle after a tap without a settlement', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    expect(engine.pointerUp(point(3, 2, 100))).toBeNull();
    expect(engine.getSnapshot().state).toBe('idle');
    expect(engine.pointerDown(point(0, 0, 200))).toBe(true);
  });
  it('commits a slow long drag by distance, including the exact threshold', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-80, 0, 1000));
    expect(engine.pointerUp(point(-80, 0, 2000))?.direction).toBe('left');
  });
  it.each([40, 60])('commits a short flick by velocity at release time %i', (time) => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-30, 0, 30));
    expect(engine.pointerUp(point(-30, 0, time))?.direction).toBe('left');
  });
  it('uses recent motion after a long stationary hold', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(0, 0, 1000));
    engine.pointerMove(point(-30, 0, 1010));
    expect(engine.pointerUp(point(-30, 0, 1020))?.direction).toBe('left');
  });
  it.each([200, 2000])('does not reuse stale flick velocity after a pause of %i ms', (time) => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-30, 0, 10));
    const plan = engine.pointerUp(point(-30, 0, time));
    expect(plan?.direction).toBeNull();
    expect(plan?.to).toEqual({ x: 0, y: 0 });
  });
  it('returns an insufficient slow gesture to the origin', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(79, 0, 1000));
    const plan = engine.pointerUp(point(79, 0, 1100));
    expect(plan).toMatchObject({ direction: null, from: { x: 79, y: 0 }, to: { x: 0, y: 0 } });
    expect(engine.getSnapshot().state).toBe('settling');
  });
  it('does not create infinite velocity from equal timestamps', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-30));
    expect(engine.pointerUp(point(-30))?.direction).toBeNull();
  });
  it('ignores older timestamps without changing the active gesture', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-20, 0, 100));
    const snapshot = engine.getSnapshot();
    expect(engine.pointerMove(point(200, 0, 99))).toBe(false);
    expect(engine.pointerUp(point(200, 0, 99))).toBeNull();
    expect(engine.getSnapshot()).toEqual(snapshot);
    expect(engine.pointerUp(point(-100, 0, 1000))?.direction).toBe('left');
  });
  it('a fast reversal cancels an otherwise sufficient distance', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-120, 0, 100));
    engine.pointerMove(point(-100, 0, 110));
    expect(engine.pointerUp(point(-100, 0, 120))?.direction).toBeNull();
  });
  it('can commit the opposite neighbor after crossing the origin', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-100, 0, 100));
    engine.pointerMove(point(30, 0, 110));
    expect(engine.getSnapshot().offset).toEqual({ x: 30, y: 0 });
    expect(engine.pointerUp(point(30, 0, 120))?.direction).toBe('right');
  });
  it('a slow correction does not override a sufficient distance', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-120, 0, 1000));
    engine.pointerMove(point(-100, 0, 2000));
    expect(engine.pointerUp(point(-100, 0, 2100))?.direction).toBe('left');
  });
  it('returning exactly to the origin never commits by velocity', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-100, 0, 100));
    expect(engine.pointerUp(point(0, 0, 110))?.direction).toBeNull();
  });
  it.each([2, 16, 256, 4096])('handles a linear flick sampled %i times', (count) => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    for (let i = 1; i <= count; i += 1) {
      engine.pointerMove(point((-30 * i) / count, 0, (30 * i) / count));
    }
    expect(engine.pointerUp(point(-30, 0, 40))?.direction).toBe('left');
  });
  it('caps travel at one viewport even for a huge gesture', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-10000, 0, 1000));
    expect(engine.getSnapshot().offset).toEqual({ x: -300, y: 0 });
    expect(engine.pointerUp(point(-10000, 0, 1100))?.to).toEqual({ x: -300, y: 0 });
  });
  it.each(directions)('applies elastic resistance at the %s edge and never commits', (direction, x, y) => {
    const input = context();
    const engine = createGestureEngine({ ...input, neighbors: { ...input.neighbors, [direction]: false } });
    engine.pointerDown(point());
    engine.pointerMove(point(x, y, 10));
    const { offset } = engine.getSnapshot();
    const resisted = Math.abs(x !== 0 ? offset.x : offset.y);
    expect(resisted).toBeGreaterThan(0);
    expect(resisted).toBeLessThan(35);
    const plan = engine.pointerUp(point(x, y, 20));
    expect(plan?.direction).toBeNull();
    expect(plan?.from).toEqual(offset);
    expect(plan?.to).toEqual({ x: 0, y: 0 });
  });
  it('resistance grows monotonically and saturates below extent * resistance', () => {
    const input = context();
    const engine = createGestureEngine({ ...input, neighbors: { ...input.neighbors, right: false } });
    engine.pointerDown(point());
    engine.pointerMove(point(300, 0, 10));
    expect(engine.getSnapshot().offset.x).toBeCloseTo(52.5);
    engine.pointerMove(point(600, 0, 20));
    expect(engine.getSnapshot().offset.x).toBeCloseTo(70);
    engine.pointerMove(point(1000000, 0, 30));
    expect(engine.getSnapshot().offset.x).toBeLessThan(105);
  });
  it('can reverse from a blocked edge into an available neighbor', () => {
    const input = context();
    const engine = createGestureEngine({ ...input, neighbors: { ...input.neighbors, left: false } });
    engine.pointerDown(point());
    engine.pointerMove(point(-100, 0, 100));
    engine.pointerMove(point(100, 0, 200));
    expect(engine.getSnapshot().offset).toEqual({ x: 100, y: 0 });
    expect(engine.pointerUp(point(100, 0, 210))?.direction).toBe('right');
  });
  it('honors zero resistance and zero animation duration', () => {
    const input = context();
    const engine = createGestureEngine(
      { ...input, neighbors: { ...input.neighbors, up: false } },
      { edgeResistance: 0, animationDuration: 0 },
    );
    engine.pointerDown(point());
    engine.pointerMove(point(0, -100, 100));
    expect(engine.getSnapshot().offset).toEqual({ x: 0, y: 0 });
    const plan = engine.pointerUp(point(0, -100, 110));
    assert(plan !== null);
    expect(plan.duration).toBe(0);
    expect(plan.direction).toBeNull();
    expect(engine.getSnapshot().state).toBe('settling');
    expect(engine.finishSettling(plan)).toBe(true);
  });
  it('ignores other pointers, duplicate downs, and conflicting events while settling', () => {
    const engine = createGestureEngine(context());
    expect(engine.pointerMove(point())).toBe(false);
    expect(engine.pointerUp(point())).toBeNull();
    expect(engine.pointerDown(point(10, 20, 0, 7))).toBe(true);
    expect(engine.pointerDown(point(200, 200, 1, 7))).toBe(false);
    expect(engine.pointerDown(point(200, 200, 2, 8))).toBe(false);
    expect(engine.pointerMove(point(-300, 0, 10, 8))).toBe(false);
    expect(engine.pointerUp(point(-300, 0, 20, 8))).toBeNull();
    expect(engine.pointerCancel(8)).toBeNull();
    expect(engine.lostPointerCapture(8)).toBeNull();
    expect(engine.getSnapshot().pointerId).toBe(7);
    const plan = engine.pointerUp(point(-100, 20, 1000, 7));
    assert(plan !== null);
    const snapshot = engine.getSnapshot();
    expect(engine.pointerDown(point())).toBe(false);
    expect(engine.pointerMove(point(-100, 0, 1100, 7))).toBe(false);
    expect(engine.pointerUp(point(-100, 0, 1100, 7))).toBeNull();
    expect(engine.pointerCancel(7)).toBeNull();
    expect(engine.lostPointerCapture(7)).toBeNull();
    expect(engine.getSnapshot()).toEqual(snapshot);
    expect(engine.finishSettling({ ...plan })).toBe(false);
    expect(engine.finishSettling(plan)).toBe(true);
    expect(engine.pointerDown(point(0, 0, 2000, 8))).toBe(true);
  });
  it.each(['pointerCancel', 'lostPointerCapture'] as const)('%s rolls back dragging but ends tracking immediately', (method) => {
    const engine = createGestureEngine(context());
    expect(engine[method](1)).toBeNull();
    engine.pointerDown(point());
    expect(engine[method](1)).toBeNull();
    expect(engine.getSnapshot().state).toBe('idle');
    engine.pointerDown(point());
    engine.pointerMove(point(0, -100, 100));
    const plan = engine[method](1);
    assert(plan !== null);
    expect(plan).toMatchObject({ direction: null, from: { x: 0, y: -100 }, to: { x: 0, y: 0 } });
    expect(engine.getSnapshot().state).toBe('settling');
    expect(engine.finishSettling(plan)).toBe(true);
  });
  it('replaces context atomically and invalidates old settlement tokens', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    const old = engine.pointerUp(point(-100, 0, 1000));
    assert(old !== null);
    engine.updateContext({ ...context(), width: 400 });
    expect(engine.getSnapshot().state).toBe('idle');
    engine.pointerDown(point());
    const current = engine.pointerUp(point(-100, 0, 1000));
    assert(current !== null);
    expect(current.to).toEqual({ x: -400, y: 0 });
    expect(engine.finishSettling(old)).toBe(false);
    expect(engine.getSnapshot().state).toBe('settling');
    expect(engine.finishSettling(current)).toBe(true);
  });
  it('context replacement cancels an active gesture and snapshots new neighbors', () => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    engine.pointerMove(point(-50, 0, 100));
    const input = { width: 200, height: 400, neighbors: { up: true, down: true, left: false, right: true } };
    engine.updateContext(input);
    input.neighbors.left = true;
    expect(engine.getSnapshot()).toMatchObject({ state: 'idle', offset: { x: 0, y: 0 } });
    expect(engine.pointerMove(point(-100, 0, 110))).toBe(false);
    engine.pointerDown(point());
    expect(engine.pointerUp(point(-100, 0, 20))?.direction).toBeNull();
  });
  it.each(['tracking', 'dragging', 'settling'] as const)('destroy during %s is terminal and idempotent', (state) => {
    const engine = createGestureEngine(context());
    engine.pointerDown(point());
    if (state !== 'tracking') {
      engine.pointerMove(point(-100, 0, 100));
    }
    const plan = state === 'settling' ? engine.pointerUp(point(-100, 0, 200)) : null;
    engine.destroy();
    engine.destroy();
    expect(engine.getSnapshot()).toEqual({ state: 'idle', axis: null, pointerId: null, offset: { x: 0, y: 0 }, destroyed: true });
    expect(engine.pointerDown(point())).toBe(false);
    expect(engine.pointerMove(point())).toBe(false);
    expect(engine.pointerUp(point())).toBeNull();
    expect(engine.pointerCancel(1)).toBeNull();
    expect(engine.lostPointerCapture(1)).toBeNull();
    engine.updateContext(context());
    if (plan !== null) {
      expect(engine.finishSettling(plan)).toBe(false);
    }
    expect(engine.getSnapshot().destroyed).toBe(true);
    expect(createGestureEngine(context()).pointerDown(point())).toBe(true);
  });
  it('keeps instances and settlement tokens independent across repeated gestures', () => {
    const first = createGestureEngine(context());
    const second = createGestureEngine(context());
    second.pointerDown(point());
    const secondPlan = second.pointerUp(point(-100, 0, 1000));
    assert(secondPlan !== null);
    for (let i = 0; i < 100; i += 1) {
      expect(first.pointerDown(point())).toBe(true);
      const plan = first.pointerUp(point(-100, 0, 1000));
      assert(plan !== null);
      expect(second.finishSettling(plan)).toBe(false);
      expect(first.finishSettling(secondPlan)).toBe(false);
      expect(first.finishSettling(plan)).toBe(true);
    }
    expect(second.getSnapshot().state).toBe('settling');
    expect(second.finishSettling(secondPlan)).toBe(true);
  });
  describe('validation', () => {
    it.each([null, [], 7, { distanceThreshold: '80' }, { distanceThreshold: undefined }, { unknown: 1 }].map((value) => [value]))(
      'rejects malformed options %j',
      (input) => {
        expect(() => createGestureEngine(context(), input as Partial<GestureOptions>)).toThrow(TypeError);
      },
    );
    const invalidOptions: [keyof GestureOptions, number][] = [
      ['distanceThreshold', 0],
      ['distanceThreshold', -1],
      ['distanceThreshold', NaN],
      ['velocityThreshold', 0],
      ['velocityThreshold', Infinity],
      ['axisLockThreshold', 0],
      ['axisLockThreshold', -1],
      ['animationDuration', -1],
      ['animationDuration', Infinity],
      ['edgeResistance', -0.01],
      ['edgeResistance', 1.01],
      ['edgeResistance', NaN],
    ];
    it.each(invalidOptions)('rejects %s=%s', (key, value) => {
      expect(() => createGestureEngine(context(), { [key]: value })).toThrow(RangeError);
    });
    it('accepts partial overrides and the upper resistance bound', () => {
      const engine = createGestureEngine(context(), {
        axisLockThreshold: 20,
        distanceThreshold: 30,
        velocityThreshold: 10,
        animationDuration: 50,
        edgeResistance: 1,
      });
      engine.pointerDown(point());
      engine.pointerMove(point(19, 0, 10));
      expect(engine.getSnapshot().state).toBe('tracking');
      expect(engine.pointerUp(point(30, 0, 1000))).toMatchObject({ direction: 'right', duration: 50 });
    });
    const invalidContexts: unknown[] = [
      null,
      {},
      { ...context(), width: '300' },
      { ...context(), neighbors: null },
      { ...context(), neighbors: { up: true } },
      { ...context(), neighbors: { ...context().neighbors, up: 1 } },
    ];
    it.each(invalidContexts.map((value) => [value]))('rejects malformed context %j without interrupting a gesture', (input) => {
      expect(() => createGestureEngine(input as GestureContext)).toThrow(TypeError);
      const engine = createGestureEngine(context());
      engine.pointerDown(point());
      const snapshot = engine.getSnapshot();
      expect(() => {
        engine.updateContext(input as GestureContext);
      }).toThrow(TypeError);
      expect(engine.getSnapshot()).toEqual(snapshot);
    });
    it.each([0, -1, NaN, Infinity, Number.MAX_VALUE])('rejects invalid geometry %s', (size) => {
      expect(() => createGestureEngine({ ...context(), width: size })).toThrow(RangeError);
      expect(() => createGestureEngine({ ...context(), height: size })).toThrow(RangeError);
    });
    const badSamples: unknown[] = [null, {}, { ...point(), x: '0' }];
    it.each(badSamples.map((value) => [value]))('rejects malformed pointer sample %j atomically', (input) => {
      const engine = createGestureEngine(context());
      expect(() => engine.pointerDown(input as PointerSample)).toThrow(TypeError);
      expect(engine.getSnapshot().state).toBe('idle');
      engine.pointerDown(point());
      const snapshot = engine.getSnapshot();
      expect(() => engine.pointerMove(input as PointerSample)).toThrow(TypeError);
      expect(() => engine.pointerUp(input as PointerSample)).toThrow(TypeError);
      expect(engine.getSnapshot()).toEqual(snapshot);
    });
    const badNumbers: PointerSample[] = [
      { ...point(), pointerId: -1 },
      { ...point(), pointerId: 1.5 },
      { ...point(), time: -1 },
      { ...point(), time: Infinity },
      { ...point(), x: NaN },
      { ...point(), y: Number.MAX_VALUE },
    ];
    it.each(badNumbers)('rejects invalid pointer numbers %j', (input) => {
      const engine = createGestureEngine(context());
      expect(() => engine.pointerDown(input)).toThrow(RangeError);
      engine.pointerDown(point());
      const snapshot = engine.getSnapshot();
      expect(() => engine.pointerMove(input)).toThrow(RangeError);
      expect(engine.getSnapshot()).toEqual(snapshot);
    });
    it('does not cancel a settlement when a replacement context is invalid', () => {
      const engine = createGestureEngine(context());
      engine.pointerDown(point());
      const plan = engine.pointerUp(point(-100, 0, 1000));
      assert(plan !== null);
      expect(() => {
        engine.updateContext({ ...context(), width: 0 });
      }).toThrow(RangeError);
      expect(engine.getSnapshot().state).toBe('settling');
      expect(engine.finishSettling(plan)).toBe(true);
    });
  });
});
