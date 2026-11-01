import { expect, test } from '@playwright/test';
import type { BrowserContext, Page, CDPSession } from '@playwright/test';
import type { SwipeEngine, EdgeActionPhase } from '../../src/dom';

declare global {
  interface Window {
    edgeFixture: {
      readonly state: { requests: number; errors: string[]; phase: EdgeActionPhase; aborted: boolean };
      readonly engine: SwipeEngine<string>;
      /**
       * finish. Complete the pending application request.
       */
      finish(): void;
      /**
       * fail. Reject the pending application request.
       */
      fail(): void;
    };
  }
}

/**
 * pull. Drag a real mouse or touch pointer toward the missing upper cell.
 * @param page The browser page under test.
 * @param context The browser context used for touch input.
 * @param touch Whether the project uses touch input.
 * @param distance The finger displacement in CSS pixels.
 * @returns A callback that releases or cancels the active pointer.
 */
async function pull(page: Page, context: BrowserContext, touch: boolean, distance = 400) {
  let session: CDPSession | null = null;
  if (touch) {
    session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 100, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 100 + distance, id: 1 }] });
  } else {
    await page.mouse.move(150, 100);
    await page.mouse.down();
    await page.mouse.move(150, 100 + distance, { steps: 10 });
  }

  return async (cancel = false): Promise<void> => {
    if (session !== null) {
      await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await session.detach();
    } else if (cancel) {
      await page.evaluate(() => {
        window.edgeFixture.engine.destroy();
      });
      await page.mouse.up();
    } else {
      await page.mouse.up();
    }
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/edge');
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('A1');
});

test('holds a revealed indicator until completion and keeps the same cell through data updates', async ({ page, context }, info) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });
  const release = await pull(page, context, info.project.name.includes('touch'));
  await expect(page.locator('#indicator')).toHaveAttribute('data-phase', 'armed');
  await release();
  await expect(page.locator('#indicator')).toHaveAttribute('data-phase', 'loading');
  const current = page.locator('[data-tikitaki-role="current"]');
  await expect(current).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 64)');
  expect(await page.evaluate(() => window.edgeFixture.state.requests)).toBe(1);
  expect(await page.evaluate(() => window.edgeFixture.engine.navigate('up'))).toBe(false);
  await page.evaluate(() => {
    window.edgeFixture.engine.updateGrid([['Fresh A1', 'A2'], ['B1']]);
  });
  await expect(current).toHaveText('Fresh A1');
  await expect(current).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 64)');
  const releaseAgain = await pull(page, context, info.project.name.includes('touch'));
  await releaseAgain();
  expect(await page.evaluate(() => window.edgeFixture.state.requests)).toBe(1);
  await page.evaluate(() => {
    window.edgeFixture.finish();
  });
  await expect(page.locator('#indicator')).toBeHidden();
  await expect(current).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  expect(await page.evaluate(() => window.edgeFixture.engine.getPosition())).toEqual({ row: 0, col: 0 });
  expect(await page.evaluate(() => window.edgeFixture.state.errors)).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(await page.locator('[data-tikitaki-cell]').count()).toBe(3);
});

test('returns a short pull without starting a request', async ({ page, context }, info) => {
  const release = await pull(page, context, info.project.name.includes('touch'), 40);
  await expect(page.locator('#indicator')).toHaveAttribute('data-phase', 'pulling');
  await release();
  await expect(page.locator('#indicator')).toBeHidden();
  expect(await page.evaluate(() => window.edgeFixture.state.requests)).toBe(0);
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
});

test('returns after a failed request and permits another swipe', async ({ page, context }, info) => {
  const release = await pull(page, context, info.project.name.includes('touch'));
  await release();
  await expect(page.locator('#indicator')).toHaveAttribute('data-phase', 'loading');
  await page.evaluate(() => {
    window.edgeFixture.fail();
  });
  await expect(page.locator('#indicator')).toBeHidden();
  expect(await page.evaluate(() => window.edgeFixture.state.errors)).toEqual(['Request failed']);
  expect(await page.evaluate(() => window.edgeFixture.engine.navigate('up'))).toBe(true);
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('B1');
});

test('uses the primary column for vertical swipes and refreshes only its upper boundary', async ({ page, context }, info) => {
  await page.goto('/edge?primary');
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('A4');
  await page.evaluate(() => window.edgeFixture.engine.goTo({ row: 0, col: 0 }));
  const touch = info.project.name.includes('touch');
  if (touch) {
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 450, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 200, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(150, 450);
    await page.mouse.down();
    await page.mouse.move(150, 200, { steps: 10 });
    await page.mouse.up();
  }
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('B4');
  const previous = await pull(page, context, touch, 250);
  await previous();
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveText('A4');
  await page.evaluate(() => window.edgeFixture.engine.goTo({ row: 0, col: 0 }));
  const boundary = await pull(page, context, touch);
  await boundary();
  await expect(page.locator('[data-tikitaki-role="current"]')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  expect(await page.evaluate(() => window.edgeFixture.state.requests)).toBe(0);
  await page.evaluate(() => window.edgeFixture.engine.goTo({ row: 0, col: 3 }));
  const refresh = await pull(page, context, touch);
  await refresh();
  await expect(page.locator('#indicator')).toHaveAttribute('data-phase', 'loading');
  expect(await page.evaluate(() => window.edgeFixture.state.requests)).toBe(1);
  await page.evaluate(() => {
    window.edgeFixture.finish();
  });
  await expect(page.locator('#indicator')).toBeHidden();
  expect(await page.evaluate(() => window.edgeFixture.engine.getPosition())).toEqual({ row: 0, col: 3 });
});
