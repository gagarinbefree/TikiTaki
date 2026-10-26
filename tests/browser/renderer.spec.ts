import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Direction, Position } from '../../src/index';
import type { RendererSize } from '../../src/dom';
declare global {
  interface Window {
    fixture: {
      errors: string[];
      lifecycle: { mounts: number; unmounts: number };
      /**
       * getPosition
       * @returns The resulting cell coordinates.
       */
      getPosition(): Position;
      /**
       * getSize
       * @returns The cached container width and height in CSS pixels.
       */
      getSize(): RendererSize;
      /**
       * state
       * @returns The resulting string.
       */
      state(): string;
      /**
       * slide
       * @param direction The requested navigation direction.
       * @param duration The duration argument.
       * @returns A promise that resolves to whether the operation succeeded.
       */
      slide(direction: Direction, duration?: number): Promise<boolean>;
      /**
       * rollback
       * @returns A promise that resolves to whether the operation succeeded.
       */
      rollback(): Promise<boolean>;
      /**
       * resize
       * @param width The width argument.
       * @param height The height argument.
       */
      resize(width: number, height: number): void;
      /**
       * cancelInput
       */
      cancelInput(): void;
      /**
       * destroy
       */
      destroy(): void;
    };
  }
}
const consoleErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, browser }, info) => {
  info.annotations.push({ type: 'chrome-version', description: browser.version() });
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/');
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('A10');
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => window.fixture.errors)).toEqual([]);
  expect(consoleErrors.get(page)).toEqual([]);
});
test('mounts only valid neighbors, preserves target identity, and keeps it centered after commit', async ({ page }) => {
  await expect(page.locator('[data-tikitaki-cell]')).toHaveCount(3);
  const target = page.locator('[data-tikitaki-role="up"]');
  const mount = await target.getAttribute('data-mount-id');
  await expect(target).toHaveText('B1');
  expect(await page.evaluate(() => window.fixture.slide('up'))).toBe(true);
  const current = page.locator('[data-tikitaki-role="current"]');
  await expect(current).toHaveText('B1');
  await expect(current).toHaveAttribute('data-mount-id', mount ?? 'missing');
  const viewport = await page.locator('#grid').boundingBox();
  const bounds = await current.boundingBox();
  expect(bounds).toEqual(viewport);
  await expect(page.locator('[data-tikitaki-role="down"]')).toHaveText('A1');
  expect(await page.evaluate(() => window.fixture.slide('down'))).toBe(true);
  await expect(current).toHaveText('A1');
});
test('real RAF animation has intermediate monotonic transforms and no jump at commit', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const current = document.querySelector<HTMLElement>('[data-tikitaki-role="current"]');
    const target = document.querySelector<HTMLElement>('[data-tikitaki-role="up"]');
    const container = document.querySelector('#grid');
    if (current === null || target === null || container === null) {
      throw new Error('Missing cells');
    }
    const origin = container.getBoundingClientRect().top;
    const pending = window.fixture.slide('up', 320);
    const samples: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      await new Promise(requestAnimationFrame);
      samples.push(current.getBoundingClientRect().top - origin);
    }
    const completed = await pending;
    const result = {
      completed,
      samples,
      targetTop: target.getBoundingClientRect().top - origin,
      currentText: document.querySelector('[data-tikitaki-role="current"]')?.textContent,
    };

    return result;
  });
  expect(result.completed).toBe(true);
  expect(result.samples.some((value) => value < 0 && value > -600)).toBe(true);
  for (let i = 1; i < result.samples.length; i += 1) expect(result.samples[i]).toBeLessThanOrEqual(result.samples[i - 1] ?? Infinity);
  expect(result.targetTop).toBe(0);
  expect(result.currentText).toBe('B1');
});
test('rollback returns the visible cell to its original bounds', async ({ page }) => {
  expect(await page.evaluate(() => window.fixture.rollback())).toBe(true);
  const current = page.locator('[data-tikitaki-role="current"]');
  await expect(current).toHaveText('A10');
  expect(await current.boundingBox()).toEqual(await page.locator('#grid').boundingBox());
  expect(await page.evaluate(() => window.fixture.getPosition())).toEqual({ row: 0, col: 9 });
});
test('conflicting transitions settle once without a second navigation', async ({ page }) => {
  const result = await page.evaluate(() => Promise.all([window.fixture.slide('up', 200), window.fixture.slide('up', 200)]));
  expect(result).toEqual([true, false]);
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('B1');
  expect(await page.evaluate(() => window.fixture.getPosition())).toEqual({ row: 1, col: 0 });
  expect(await page.locator('[data-tikitaki-role="current"]').boundingBox()).toEqual(await page.locator('#grid').boundingBox());
});
test('resize cancels an active transition, updates geometry, and allows a fresh transition', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const pending = window.fixture.slide('up', 1000);
    await new Promise(requestAnimationFrame);
    window.fixture.resize(320, 680);
    const completed = await pending;
    const result = { completed, size: window.fixture.getSize(), position: window.fixture.getPosition() };

    return result;
  });
  expect(result).toEqual({ completed: false, size: { width: 320, height: 680 }, position: { row: 0, col: 9 } });
  expect(await page.evaluate(() => window.fixture.slide('up'))).toBe(true);
  expect(await page.locator('[data-tikitaki-role="current"]').boundingBox()).toEqual(await page.locator('#grid').boundingBox());
});
test('native mouse/touch input follows the pointer, switches rows, and respects the B1 edge', async ({ page, context }, info) => {
  const bounds = await page.locator('#grid').boundingBox();
  if (bounds === null) {
    throw new Error('Missing viewport');
  }
  const x = bounds.x + 150;
  const start = bounds.y + 460;
  const end = bounds.y + 150;
  if (info.project.name.includes('touch')) {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: end, id: 1 }] });
    await expect
      .poll(async () => (await page.locator('[data-tikitaki-role="current"]').boundingBox())?.y ?? bounds.y)
      .toBeLessThan(bounds.y);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, start);
    await page.mouse.down();
    await page.mouse.move(x, end, { steps: 6 });
    await expect
      .poll(async () => (await page.locator('[data-tikitaki-role="current"]').boundingBox())?.y ?? bounds.y)
      .toBeLessThan(bounds.y);
    await page.mouse.up();
  }
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('B1');
  await expect.poll(() => page.evaluate(() => window.fixture.state())).toBe('idle');
  const horizontalY = bounds.y + 300;
  if (info.project.name.includes('touch')) {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + 240, y: horizontalY, id: 3 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x + 60, y: horizontalY, id: 3 }] });
    await expect
      .poll(async () => (await page.locator('[data-tikitaki-role="current"]').boundingBox())?.x ?? bounds.x)
      .toBeLessThan(bounds.x);
    const resisted = await page.locator('[data-tikitaki-role="current"]').boundingBox();
    expect(resisted?.x).toBeGreaterThan(bounds.x - 105);
    expect(resisted?.x).toBeLessThan(bounds.x);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(bounds.x + 240, horizontalY);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 60, horizontalY, { steps: 4 });
    await expect
      .poll(async () => (await page.locator('[data-tikitaki-role="current"]').boundingBox())?.x ?? bounds.x)
      .toBeLessThan(bounds.x);
    const resisted = await page.locator('[data-tikitaki-role="current"]').boundingBox();
    expect(resisted?.x).toBeGreaterThan(bounds.x - 105);
    expect(resisted?.x).toBeLessThan(bounds.x);
    await page.mouse.up();
  }
  await expect.poll(() => page.evaluate(() => window.fixture.state())).toBe('idle');
  expect(await page.evaluate(() => window.fixture.slide('left', 50))).toBe(false);
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('B1');
  expect(await page.locator('[data-tikitaki-role="current"]').boundingBox()).toEqual(await page.locator('#grid').boundingBox());
});
test('pointer cancellation rolls back without navigating', async ({ page, context }, info) => {
  const bounds = await page.locator('#grid').boundingBox();
  if (bounds === null) {
    throw new Error('Missing viewport');
  }
  const x = bounds.x + 150;
  const y = bounds.y + 450;
  if (info.project.name.includes('touch')) {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 150, id: 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 150, { steps: 3 });
    await page.evaluate(() => {
      window.fixture.cancelInput();
    });
    await page.mouse.up();
  }
  await expect.poll(() => page.evaluate(() => window.fixture.state())).toBe('idle');
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('A10');
  expect(await page.locator('[data-tikitaki-role="current"]').boundingBox()).toEqual(await page.locator('#grid').boundingBox());
});
test('offscreen content cannot take focus and destroy releases all mounts during animation', async ({ page }) => {
  await page.locator('[data-tikitaki-role="current"] button').focus();
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-tikitaki-role="up"] button')?.focus();
  });
  await expect(page.locator('[data-tikitaki-role="current"] button')).toBeFocused();
  const result = await page.evaluate(async () => {
    const pending = window.fixture.slide('up', 1000);
    window.fixture.destroy();
    const result = { completed: await pending, ...window.fixture.lifecycle };

    return result;
  });
  expect(result.completed).toBe(false);
  expect(result.unmounts).toBe(result.mounts);
  await expect(page.locator('[data-tikitaki-viewport]')).toHaveCount(0);
});
