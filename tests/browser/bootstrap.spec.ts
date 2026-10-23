import { expect, test } from '@playwright/test';

for (const framework of ['react', 'vue', 'svelte', 'angular']) {
  test(`${framework} uses a responsive Bootstrap demo with working navigation`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto(`/demos/${framework}/`);
    await expect(page.locator('.navbar .navbar-brand')).toHaveText('TikiTaki');
    await expect(page.locator('main aside')).toHaveCount(0);
    const field = await page.locator('[data-demo-container]').boundingBox();
    expect(field).not.toBeNull();
    expect(field && field.height > field.width).toBe(true);
    expect(field && Math.abs(field.width / field.height - 9 / 16) < 0.01).toBe(true);
    const map = await page.getByRole('navigation', { name: 'Карта ячеек' }).boundingBox();
    const layout = await page.locator('[data-demo-layout]').boundingBox();
    expect(map && field && layout).toBeTruthy();
    if (map && field && layout && (page.viewportSize()?.width ?? 0) >= 768) {
      expect(Math.abs(field.x - layout.x)).toBeLessThan(1);
      expect(map.x).toBeGreaterThan(field.x + field.width);
      expect(Math.abs(map.y - field.y)).toBeLessThan(1);
      expect(Math.abs(map.height - field.height)).toBeLessThan(1);
      expect(Math.abs(map.x + map.width - layout.x - layout.width)).toBeLessThan(1);
    }
    await expect(page.locator('[data-tikitaki-role="current"] [data-item]')).toHaveAttribute('data-item', 'A1');
    await expect(page.locator('[aria-current="true"]')).toHaveClass(/theme-success/);
    await expect(page.locator('[data-navigate]')).toHaveCount(0);
    await page.getByRole('button', { name: 'C3', exact: true }).click();
    await expect(page.locator('[aria-current="true"]')).toHaveText('C3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.artifacts/bootstrap-${framework}-${String(page.viewportSize()?.width)}.png`, fullPage: true });
    const surface = page.locator('[data-tikitaki-role="current"] [data-item]');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-bs-theme', 'light');
    });
    const light = await surface.evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    });
    await expect.poll(() => surface.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(light);
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
    });
    await expect(page.getByRole('button', { name: 'C3', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
