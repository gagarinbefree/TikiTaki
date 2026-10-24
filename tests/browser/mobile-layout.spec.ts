import { expect, test } from '@playwright/test';

for (const framework of ['vanilla', 'react', 'vue', 'svelte', 'angular', 'lit']) {
  test(`${framework} fills the mobile viewport and shows centered cell dots`, async ({ page }) => {
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
    expect(size && other && size.width > other.width && size.height > other.height).toBe(true);
    expect(other && other.width <= 10 && other.height <= 10).toBe(true);
    await expect(selected).toHaveCSS('font-size', '0px');
    await expect(viewport).toHaveCSS('border-radius', '0px');
    await map.getByRole('button', { name: 'C3', exact: true }).click();
    await expect(selected).toHaveText('C3');
    await expect(page.locator('[data-tikitaki-role="current"] [data-item]')).toHaveText('C3');
    await page.screenshot({ path: `.artifacts/mobile-fullscreen-${framework}.png` });
    await page.setViewportSize({ width: 900, height: 900 });
    await expect.poll(async () => (await viewport.boundingBox())?.width).toBeLessThan(400);
    await expect(selected).not.toHaveCSS('font-size', '0px');
    await expect(selected).toHaveText('C3');
    await page.setViewportSize({ width: 667, height: 375 });
    await expect.poll(() => viewport.boundingBox()).toEqual({ x: 0, y: 0, width: 667, height: 375 });
    await expect(selected).toHaveText('C3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
