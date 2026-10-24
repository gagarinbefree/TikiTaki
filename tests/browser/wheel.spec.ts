import { expect, test } from '@playwright/test';

for (const framework of ['react', 'vue', 'svelte', 'angular']) {
  test(`${framework} navigates rows with the native wheel only over a cell`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    await page.goto(`/demos/${framework}/`);
    await page.getByRole('button', { name: 'A10', exact: true }).click();
    await page.evaluate(() => {
      document.body.style.minHeight = '200vh';
    });
    const viewport = page.locator('[data-demo-container]');
    const cell = page.locator('[data-tikitaki-role="current"] [data-item]');
    await viewport.scrollIntoViewIfNeeded();
    await viewport.hover();
    const scroll = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 240);
    await page.mouse.wheel(0, 80);
    await expect(cell).toHaveAttribute('data-item', 'B1');
    await expect(page.locator('[aria-current="true"]')).toHaveText('B1');
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.mouse.wheel(0, -240);
    await expect(cell).toHaveAttribute('data-item', 'A1');
    await expect(page.locator('[aria-current="true"]')).toHaveText('A1');
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.mouse.wheel(0, -240);
    await expect(cell).toHaveAttribute('data-item', 'A1');
    await page.mouse.move(2, 200);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scroll);
    await expect(cell).toHaveAttribute('data-item', 'A1');
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => window.tikitakiDemo.metrics().errors)).toEqual([]);
  });
}
