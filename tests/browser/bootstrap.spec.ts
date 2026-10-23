import { expect, test } from '@playwright/test';

for (const framework of ['react', 'vue']) {
  test(`${framework} uses a responsive Bootstrap demo with working navigation`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto(`/demos/${framework}/`);
    await expect(page.locator('.navbar .brand')).toHaveText('TikiTaki');
    await expect(page.locator('main.container .row-fluid > .span8')).toBeVisible();
    await expect(page.locator('main.container .row-fluid > .span4 .well')).toBeVisible();
    await expect(page.locator('[data-tikitaki-role="current"] [data-item]')).toHaveAttribute('data-item', 'A1');
    await expect(page.locator('[aria-current="true"]')).toHaveClass(/btn-success/);
    await expect(page.locator('.btn[data-navigate="up"]')).toBeVisible();
    await page.getByRole('button', { name: 'C3', exact: true }).click();
    await expect(page.locator('[aria-current="true"]')).toHaveText('C3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.artifacts/bootstrap-${framework}-${String(page.viewportSize()?.width)}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
