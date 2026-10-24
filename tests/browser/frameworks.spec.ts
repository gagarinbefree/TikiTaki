import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Direction } from 'tikitaki';
const current = '[data-tikitaki-role="current"]';
const messages = new WeakMap<Page, string[]>();
test.beforeEach(({ page, browser }, info) => {
  info.annotations.push({ type: 'chrome-version', description: browser.version() });
  const errors: string[] = [];
  messages.set(page, errors);
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
});
test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => window.tikitakiDemo.metrics().errors)).toEqual([]);
  expect(messages.get(page)).toEqual([]);
});
/** Exercise lifecycle operations without exposing a control panel in the demo. */
async function command(page: Page, name: 'goto' | 'update' | 'shrink' | 'toggle') {
  await page.evaluate((name) => {
    const commands = window.tikitakiDemo.commands;
    if (!commands) throw new Error('Demo commands are not mounted');
    if (name === 'goto') commands.goTo({ row: 0, col: 9 });
    else commands[name]();
  }, name);
}
/** Start navigation without awaiting settling so conflicting commands remain testable. */
async function navigate(page: Page, direction: Direction, repeat = false) {
  await page.evaluate(
    ({ direction, repeat }) => {
      const commands = window.tikitakiDemo.commands;
      if (!commands) throw new Error('Demo commands are not mounted');
      commands.navigate(direction);
      if (repeat) commands.navigate(direction);
    },
    { direction, repeat },
  );
}
async function centered(page: Page) {
  await expect
    .poll(async () => {
      const viewport = await page.locator('[data-tikitaki-viewport]').boundingBox();
      const cell = await page.locator(current).boundingBox();
      const result = viewport !== null && cell !== null && Math.abs(viewport.x - cell.x) < 0.5 && Math.abs(viewport.y - cell.y) < 0.5;

      return result;
    })
    .toBe(true);
}
async function item(page: Page, name: string, row: number, col: number) {
  await expect(page.locator(`${current} [data-item]`)).toHaveAttribute('data-item', name);
  await expect(page.locator('[aria-current="true"]')).toHaveAttribute('title', `row: ${String(row)}, col: ${String(col)}`);
  await centered(page);
  expect(await page.locator('[data-tikitaki-cell]').count()).toBeLessThanOrEqual(5);
}
for (const framework of ['react', 'vue', 'svelte', 'angular'] as const) {
  test.describe(`${framework} demo`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/demos/${framework}/`);
      await item(page, 'A1', 0, 0);
      await command(page, 'goto');
      await item(page, 'A10', 0, 9);
    });
    test('commands obey ragged boundaries and rapid input does not queue transitions', async ({ page }) => {
      await navigate(page, 'down');
      await item(page, 'A10', 0, 9);
      await navigate(page, 'up', true);
      await item(page, 'B1', 1, 0);
      await navigate(page, 'left');
      await navigate(page, 'right');
      await item(page, 'B1', 1, 0);
      await navigate(page, 'down');
      await item(page, 'A1', 0, 0);
      await command(page, 'goto');
      await item(page, 'A10', 0, 9);
    });
    test('cell-map selects cells and follows navigation, grid updates, and remount', async ({ page, isMobile }) => {
      const map = page.getByRole('navigation', { name: 'Cell map' });
      await expect(map).toBeVisible();
      const rows = map.locator('[data-map-row]');
      await expect(rows).toHaveCount(4);
      for (const [index, count] of [10, 1, 3, 5].entries()) {
        await expect(rows.nth(index).getByRole('button')).toHaveCount(count);
      }
      const active = map.locator('[aria-current="true"]');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveText('A10');
      await active.scrollIntoViewIfNeeded();
      await expect(active).toBeInViewport({ ratio: 0.98 });
      expect(await active.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
        await rows
          .first()
          .getByRole('button')
          .first()
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      );
      const mapBox = await map.boundingBox();
      const layoutBox = await page.locator('[data-demo-layout]').boundingBox();
      expect(mapBox !== null && layoutBox !== null && mapBox.x >= layoutBox.x && mapBox.y >= layoutBox.y).toBe(true);
      const destination = map.getByRole('button', { name: 'C3', exact: true });
      if (isMobile) {
        await destination.tap();
      } else {
        await destination.click();
      }
      await item(page, 'C3', 2, 2);
      await expect(active).toHaveText('C3');
      await navigate(page, 'up');
      await item(page, 'D1', 3, 0);
      await expect(active).toHaveText('D1');
      const keyboardCell = map.getByRole('button', { name: 'B1', exact: true });
      await keyboardCell.focus();
      await keyboardCell.press('Enter');
      await item(page, 'B1', 1, 0);
      await expect(active).toHaveText('B1');
      await command(page, 'update');
      await item(page, 'B1!', 1, 0);
      await expect(active).toHaveText('B1!');
      await command(page, 'shrink');
      await item(page, 'Only', 0, 0);
      await expect(map.getByRole('button')).toHaveCount(1);
      await expect(active).toHaveText('Only');
      await command(page, 'toggle');
      await expect(map.getByRole('button')).toBeDisabled();
      await expect(active).toHaveCount(0);
      await command(page, 'toggle');
      await item(page, 'A1', 0, 0);
      await expect(map.getByRole('button')).toHaveCount(19);
      await expect(active).toHaveText('A1');
      await expect(active).toBeEnabled();
      await map.screenshot({ path: `.artifacts/cell-map-${framework}-${isMobile ? 'touch' : 'desktop'}.png` });
    });
    test('native mouse/touch drag follows the pointer, cancels, and then commits one row', async ({ page, context, isMobile }) => {
      const viewport = page.locator('[data-demo-container]');
      await viewport.scrollIntoViewIfNeeded();
      const box = await viewport.boundingBox();
      expect(box).not.toBeNull();
      if (box === null) return;

      const x = box.x + box.width / 2,
        y = box.y + box.height * 0.7;
      const session = isMobile ? await context.newCDPSession(page) : null;
      for (const cancel of [true, false]) {
        if (session) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 130, id: 1 }] });
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x, y - 130, { steps: 6 });
        }
        await expect
          .poll(async () => {
            const cell = await page.locator(current).boundingBox();
            const result = cell !== null && cell.y < box.y - 30;

            return result;
          })
          .toBe(true);
        if (session) {
          await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        } else {
          if (cancel) {
            await page.evaluate(() => {
              const active = document.querySelector('[data-tikitaki-role="current"] [data-item]');
              active?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
            });
          }
          await page.mouse.up();
        }
        await item(page, cancel ? 'A10' : 'B1', cancel ? 0 : 1, cancel ? 9 : 0);
      }
      await session?.detach();
    });
    test('framework context and component state survive updateGrid, then a shorter grid clamps coordinates', async ({ page }) => {
      await expect(page.locator(`${current} small`)).toContainText(
        framework === 'react'
          ? 'React context'
          : framework === 'vue'
            ? 'Vue context'
            : framework === 'svelte'
              ? 'Svelte context'
              : 'Angular context',
      );
      await page.locator(`${current} [data-action="count"]`).click();
      await expect(page.locator(`${current} button`)).toHaveText('Clicks: 1');
      await command(page, 'update');
      await item(page, 'A10!', 0, 9);
      await expect(page.locator(`${current} button`)).toHaveText('Clicks: 1');
      await command(page, 'shrink');
      await item(page, 'Only', 0, 0);
      await expect(page.locator('[data-tikitaki-cell]')).toHaveCount(1);
    });
    test('cell map disables selection after destroy and restores it on remount', async ({ page }) => {
      await command(page, 'shrink');
      await item(page, 'Only', 0, 0);
      await command(page, 'toggle');
      await expect(page.locator('[data-tikitaki-viewport]')).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Cell map' }).getByRole('button')).toBeDisabled();
      await command(page, 'toggle');
      await item(page, 'A1', 0, 0);
      await expect(page.getByRole('navigation', { name: 'Cell map' }).getByRole('button')).toHaveCount(19);
    });
    test('unmount during settling pairs all lifecycles and repeated remounts leave one viewport', async ({ page }) => {
      for (let i = 0; i < 3; i++) {
        await navigate(page, 'up');
        await command(page, 'toggle');
        await expect(page.locator('[data-tikitaki-viewport]')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => window.tikitakiDemo.metrics().live)).toBe(0);
        const metrics = await page.evaluate(() => window.tikitakiDemo.metrics());
        expect(metrics.mounted).toBe(metrics.unmounted);
        expect(metrics.enginesCreated).toBe(metrics.enginesDestroyed);
        await command(page, 'toggle');
        await item(page, 'A1', 0, 0);
        await expect(page.locator('[data-tikitaki-viewport]')).toHaveCount(1);
      }
    });
    test('Vite development mode keeps one engine and releases it on unmount', async ({ page }) => {
      await page.goto(`http://127.0.0.1:4178/${framework}/`);
      await item(page, 'A1', 0, 0);
      const metrics = await page.evaluate(() => window.tikitakiDemo.metrics());
      expect(metrics.enginesCreated).toBe(framework === 'react' ? 2 : 1);
      expect(metrics.enginesCreated - metrics.enginesDestroyed).toBe(1);
      await command(page, 'toggle');
      await expect.poll(() => page.evaluate(() => window.tikitakiDemo.metrics().live)).toBe(0);
      expect(
        await page.evaluate(() => {
          const state = window.tikitakiDemo.metrics();
          const result = state.enginesCreated === state.enginesDestroyed;

          return result;
        }),
      ).toBe(true);
    });
  });
}
