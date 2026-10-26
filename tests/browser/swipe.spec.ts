import { expect, test } from '@playwright/test';
import type { BrowserContext, CDPSession, Page } from '@playwright/test';
import type { Direction, Grid, Position } from '../../src/index';
declare global {
  interface Window {
    swipeFixture: {
      state: { errors: string[]; changes: { position: Position; previous: Position }[]; taps: number; mounts: number; unmounts: number };
      /**
       * position
       * @returns The resulting cell coordinates.
       */
      position(): Position;
      /**
       * navigate
       * @param direction The requested navigation direction.
       * @returns A promise that resolves to whether the operation succeeded.
       */
      navigate(direction: Direction): Promise<boolean>;
      /**
       * goTo
       * @param position Zero based cell coordinates.
       * @returns A promise that resolves to whether the operation succeeded.
       */
      goTo(position: Position): Promise<boolean>;
      /**
       * update
       * @param grid Grid rows and their cell data.
       */
      update(grid: Grid<string>): void;
      /**
       * resize
       * @param width The width argument.
       * @param height The height argument.
       */
      resize(width: number, height: number): void;
      /**
       * captured
       * @returns Whether the operation succeeded or the condition holds.
       */
      captured(): boolean;
      /**
       * release
       */
      release(): void;
      /**
       * cancel
       */
      cancel(): void;
      /**
       * destroy
       */
      destroy(): void;
      /**
       * reinit
       */
      reinit(): void;
    };
  }
}
const errors = new WeakMap<Page, string[]>();
const current = '[data-tikitaki-role="current"]';
test.beforeEach(async ({ page, browser }, info) => {
  info.annotations.push({ type: 'chrome-version', description: browser.version() });
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', (error) => {
    messages.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      messages.push(message.text());
    }
  });
  await page.goto('/swipe');
  await expect(page.locator(current)).toHaveText('A10');
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => window.swipeFixture.state.errors)).toEqual([]);
  expect(errors.get(page)).toEqual([]);
});
/**
 * startInput
 * @param page The browser page used for verification.
 * @param context The context used by this operation.
 * @param touch The touch argument.
 * @param x The x argument.
 * @param y The y argument.
 * @returns A promise that resolves to the operation result.
 */
async function startInput(page: Page, context: BrowserContext, touch: boolean, x: number, y: number): Promise<CDPSession | null> {
  if (touch) {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });

    return session;
  }
  await page.mouse.move(x, y);
  await page.mouse.down();
  const result = null;

  return result;
}
/**
 * moveInput
 * @param page The browser page used for verification.
 * @param session The session argument.
 * @param x The x argument.
 * @param y The y argument.
 * @returns A promise that resolves when the operation completes.
 */
async function moveInput(page: Page, session: CDPSession | null, x: number, y: number) {
  if (session !== null) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  } else {
    await page.mouse.move(x, y, { steps: 5 });
  }
}
/**
 * endInput
 * @param page The browser page used for verification.
 * @param session The session argument.
 * @returns A promise that resolves when the operation completes.
 */
async function endInput(page: Page, session: CDPSession | null) {
  if (session !== null) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.up();
  }
}
/**
 * centered
 * @param page The browser page used for verification.
 * @returns A promise that resolves when the operation completes.
 */
async function centered(page: Page) {
  await expect
    .poll(async () => {
      const box = await page.locator(current).boundingBox();
      const grid = await page.locator('#grid').boundingBox();
      const result =
        box !== null && grid !== null && box.x === grid.x && box.y === grid.y && box.width === grid.width && box.height === grid.height;

      return result;
    })
    .toBe(true);
}
test('public commands preserve A10 at the edge, animate B1, and return to A1', async ({ page }) => {
  expect(await page.evaluate(() => window.swipeFixture.navigate('down'))).toBe(false);
  expect(await page.evaluate(() => window.swipeFixture.position())).toEqual({ row: 0, col: 9 });
  const id = await page.locator('[data-tikitaki-role="up"]').getAttribute('data-mount-id');
  expect(await page.evaluate(() => window.swipeFixture.navigate('up'))).toBe(true);
  await expect(page.locator(current)).toHaveText('B1');
  await expect(page.locator(current)).toHaveAttribute('data-mount-id', id ?? 'missing');
  await centered(page);
  expect(await page.evaluate(() => window.swipeFixture.navigate('left'))).toBe(false);
  expect(await page.evaluate(() => window.swipeFixture.navigate('right'))).toBe(false);
  expect(await page.evaluate(() => window.swipeFixture.navigate('down'))).toBe(true);
  await expect(page.locator(current)).toHaveText('A1');
  await centered(page);
  expect(await page.evaluate(() => window.swipeFixture.state.changes)).toHaveLength(2);
});
test('goTo jumps directly and busy commands return false without queuing', async ({ page }) => {
  expect(
    await page.evaluate(() =>
      Promise.all([window.swipeFixture.navigate('up'), window.swipeFixture.navigate('up'), window.swipeFixture.goTo({ row: 2, col: 2 })]),
    ),
  ).toEqual([true, false, false]);
  await expect(page.locator(current)).toHaveText('B1');
  expect(await page.evaluate(() => window.swipeFixture.goTo({ row: 2, col: 2 }))).toBe(true);
  await expect(page.locator(current)).toHaveText('C3');
  await centered(page);
  expect(await page.evaluate(() => window.swipeFixture.navigate('down'))).toBe(true);
  await expect(page.locator(current)).toHaveText('B1');
});
test('native taps and keyboard clicks keep working while swipes suppress accidental clicks', async ({ page, context }, info) => {
  const button = page.locator(`${current} button`);
  if (info.project.name.includes('touch')) {
    await button.tap();
  } else {
    await button.click();
  }
  expect(await page.evaluate(() => window.swipeFixture.state.taps)).toBe(1);
  expect(await page.evaluate(() => window.swipeFixture.position())).toEqual({ row: 0, col: 9 });
  const box = await page.locator('#grid').boundingBox();
  if (box === null) {
    throw new Error('No viewport');
  }
  const session = await startInput(page, context, info.project.name.includes('touch'), box.x + 150, box.y + 460);
  await moveInput(page, session, box.x + 150, box.y + 120);
  await expect.poll(async () => (await page.locator(current).boundingBox())?.y ?? box.y).toBeLessThan(box.y);
  await endInput(page, session);
  await expect(page.locator(current)).toHaveText('B1');
  await centered(page);
  expect(await page.evaluate(() => window.swipeFixture.state.taps)).toBe(1);
  await page.locator(`${current} button`).focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.swipeFixture.state.taps)).toBe(2);
});
test('real pointer input shows resistance at B1 and never crosses its horizontal edge', async ({ page, context }, info) => {
  await page.evaluate(() => window.swipeFixture.goTo({ row: 1, col: 0 }));
  const box = await page.locator('#grid').boundingBox();
  if (box === null) {
    throw new Error('No viewport');
  }
  const session = await startInput(page, context, info.project.name.includes('touch'), box.x + 240, box.y + 300);
  await moveInput(page, session, box.x + 50, box.y + 300);
  await expect.poll(async () => (await page.locator(current).boundingBox())?.x ?? box.x).toBeLessThan(box.x);
  const moved = await page.locator(current).boundingBox();
  expect(moved?.x).toBeGreaterThan(box.x - 105);
  await endInput(page, session);
  await centered(page);
  expect(await page.evaluate(() => window.swipeFixture.position())).toEqual({ row: 1, col: 0 });
  await expect(page.locator(current)).toHaveText('B1');
});
test('cancellation and lost capture return to the origin without changing position', async ({ page, context }, info) => {
  const box = await page.locator('#grid').boundingBox();
  if (box === null) {
    throw new Error('No viewport');
  }
  const session = await startInput(page, context, info.project.name.includes('touch'), box.x + 150, box.y + 460);
  await moveInput(page, session, box.x + 150, box.y + 300);
  await expect.poll(() => page.evaluate(() => window.swipeFixture.captured())).toBe(true);
  if (session !== null) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await session.detach();
  } else {
    await page.evaluate(() => {
      window.swipeFixture.release();
    });
    await page.mouse.up();
  }
  await centered(page);
  expect(await page.evaluate(() => window.swipeFixture.position())).toEqual({ row: 0, col: 9 });
  expect(await page.evaluate(() => window.swipeFixture.state.changes)).toHaveLength(0);
  expect(await page.evaluate(() => window.swipeFixture.captured())).toBe(false);
});
test('grid replacement cancels a Promise and invalid replacement preserves another', async ({ page }) => {
  expect(
    await page.evaluate(async () => {
      const pending = window.swipeFixture.navigate('up');
      window.swipeFixture.update([['only']]);

      return pending;
    }),
  ).toBe(false);
  await expect(page.locator(current)).toHaveText('only');
  await centered(page);
  await page.evaluate(() => {
    window.swipeFixture.reinit();
  });
  const result = await page.evaluate(async () => {
    const pending = window.swipeFixture.navigate('up');
    let error = '';
    try {
      window.swipeFixture.update([[]]);
    } catch (failure) {
      error = String(failure);
    }
    const result = { error, completed: await pending, position: window.swipeFixture.position() };

    return result;
  });
  expect(result.error).toContain('RangeError');
  expect(result.completed).toBe(true);
  expect(result.position).toEqual({ row: 1, col: 0 });
  await centered(page);
});
test('resize and hiding cancel safely and allow a fresh navigation after showing', async ({ page }) => {
  const cancelled = await page.evaluate(async () => {
    const pending = window.swipeFixture.navigate('up');
    await new Promise(requestAnimationFrame);
    window.swipeFixture.resize(320, 680);

    return pending;
  });
  expect(cancelled).toBe(false);
  expect(await page.evaluate(() => window.swipeFixture.position())).toEqual({ row: 0, col: 9 });
  await page.evaluate(() => {
    window.swipeFixture.resize(0, 0);
  });
  await expect(page.locator('[data-tikitaki-viewport]')).toHaveCSS('visibility', 'hidden');
  expect(await page.evaluate(() => window.swipeFixture.navigate('up'))).toBe(false);
  expect(await page.evaluate(() => window.swipeFixture.goTo({ row: 2, col: 2 }))).toBe(true);
  await page.evaluate(() => {
    window.swipeFixture.resize(300, 600);
  });
  await expect(page.locator('[data-tikitaki-viewport]')).toHaveCSS('visibility', 'visible');
  expect(await page.evaluate(() => window.swipeFixture.navigate('down'))).toBe(true);
  await expect(page.locator(current)).toHaveText('B1');
  await centered(page);
});
test('destroy during a captured drag removes resources and supports reinitialization', async ({ page, context }, info) => {
  const box = await page.locator('#grid').boundingBox();
  if (box === null) {
    throw new Error('No viewport');
  }
  const session = await startInput(page, context, info.project.name.includes('touch'), box.x + 150, box.y + 460);
  await moveInput(page, session, box.x + 150, box.y + 300);
  expect(await page.evaluate(() => window.swipeFixture.captured())).toBe(true);
  const stats = await page.evaluate(() => {
    window.swipeFixture.destroy();
    const result = window.swipeFixture.state;

    return result;
  });
  expect(stats.mounts).toBe(stats.unmounts);
  expect(await page.evaluate(() => window.swipeFixture.captured())).toBe(false);
  await expect(page.locator('[data-tikitaki-viewport]')).toHaveCount(0);
  await expect(page.locator('#grid')).not.toHaveAttribute('data-tikitaki-engine');
  await endInput(page, session);
  await page.evaluate(() => {
    window.swipeFixture.reinit();
  });
  expect(await page.evaluate(() => window.swipeFixture.navigate('up'))).toBe(true);
  await expect(page.locator(current)).toHaveText('B1');
  await centered(page);
});
test('removal of the capture target does not leave the engine stuck tracking', async ({ page, context }, info) => {
  const box = await page.locator('#grid').boundingBox();
  if (box === null) {
    throw new Error('No viewport');
  }
  const session = await startInput(page, context, info.project.name.includes('touch'), box.x + 150, box.y + 460);
  await page.locator(`${current} button`).evaluate((element) => {
    element.remove();
  });
  await moveInput(page, session, box.x + 150, box.y + 300);
  await endInput(page, session);
  await expect.poll(() => page.evaluate(() => window.swipeFixture.navigate('up'))).toBe(true);
  await expect(page.locator(current)).toHaveText('B1');
  await centered(page);
});
