import { expect, test } from '@playwright/test';

for (const framework of ['vanilla', 'react', 'vue', 'svelte', 'angular', 'lit']) {
  test(`${framework} fills the mobile viewport and shows centered cell dots`, async ({ page, isMobile }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/demos/${framework}/`);
    const viewport = page.locator('[data-demo-container]');
    const map = page.getByRole('navigation', { name: 'Cell map' });
    await expect.poll(() => viewport.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    const selected = map.locator('[aria-current="true"]');
    await expect(selected).toHaveText('A1');
    await expect(map.getByRole('button')).toHaveCount(19);
    const bounds = await map.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(Math.abs(bounds.x + bounds.width / 2 - 195)).toBeLessThan(1);
      expect(bounds.y).toBeGreaterThan(780);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    }
    const size = await selected.boundingBox();
    const other = await map.getByRole('button', { name: 'A2', exact: true }).boundingBox();
    expect(size && { width: size.width, height: size.height }).toEqual({ width: 2, height: 2 });
    expect(other && { width: other.width, height: other.height }).toEqual({ width: 1, height: 1 });
    const rowBounds = [];
    for (const [index, count] of [10, 1, 3, 5].entries()) {
      const row = map.locator('[data-map-row]').nth(index);
      await expect(row.getByRole('button')).toHaveCount(count);
      rowBounds.push(await row.boundingBox());
    }
    for (let index = 1; index < rowBounds.length; index++) {
      const previous = rowBounds[index - 1];
      const current = rowBounds[index];
      expect(previous && current && current.y > previous.y).toBe(true);
      expect(previous && current && Math.abs(current.x - previous.x) < 1).toBe(true);
    }
    await expect(selected.locator('span')).toHaveClass('visually-hidden');
    await expect(viewport).toHaveCSS('border-radius', '0px');
    await map.getByRole('button', { name: 'C3', exact: true }).click();
    await expect(selected).toHaveText('C3');
    await expect(page.locator('[data-tikitaki-role="current"] [data-item]')).toHaveText('C3');
    await page.screenshot({ path: `.artifacts/mobile-fullscreen-${framework}.png` });
    await page.setViewportSize({ width: 900, height: 900 });
    if (isMobile) {
      await expect.poll(() => viewport.boundingBox()).toEqual({ x: 0, y: 0, width: 900, height: 900 });
    } else {
      await expect.poll(async () => (await viewport.boundingBox())?.width).toBeLessThan(400);
      await expect(selected.locator('span')).not.toHaveClass('visually-hidden');
    }
    await expect(selected).toHaveText('C3');
    await page.setViewportSize({ width: 667, height: 375 });
    await expect
      .poll(async () => {
        const field = await viewport.boundingBox();
        const bounds = await map.boundingBox();
        return Boolean(field && bounds && bounds.x > field.x + field.width);
      })
      .toBe(true);
    await expect(selected).toHaveText('C3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const framework of ['vanilla', 'react', 'vue', 'svelte', 'angular', 'lit']) {
  test(`${framework} uses fullscreen dots on a wide portrait tablet and side-by-side panels in landscape`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Requires a touch device');
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto(`/demos/${framework}/`);
    const viewport = page.locator('[data-demo-container]');
    const map = page.getByRole('navigation', { name: 'Cell map' });
    await expect.poll(() => viewport.boundingBox()).toEqual({ x: 0, y: 0, width: 1024, height: 1366 });
    await expect(map.getByText('Click a cell to navigate.', { exact: false })).toBeHidden();
    await map.getByRole('button', { name: 'C3', exact: true }).click();
    await page.setViewportSize({ width: 1366, height: 1024 });
    await expect.poll(async () => (await viewport.boundingBox())?.width).toBeLessThan(400);
    const field = await viewport.boundingBox();
    const bounds = await map.boundingBox();
    expect(field && bounds && bounds.x > field.x + field.width).toBe(true);
    await expect(map.locator('[aria-current="true"]')).toHaveText('C3');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect
      .poll(async () => {
        const field = await viewport.boundingBox();
        const bounds = await map.boundingBox();
        return Boolean(field && bounds && bounds.x > field.x + field.width);
      })
      .toBe(true);
  });
}
