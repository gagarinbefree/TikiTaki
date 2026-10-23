import { expect, test } from '@playwright/test';

for (const framework of ['react', 'vue']) {
  test(`${framework} starts at A1 and resets to A1 after remount`, async ({ page }) => {
    await page.goto(`/demos/${framework}/`);
    const current = page.locator('[data-tikitaki-role="current"] [data-item]');
    const selected = page.locator('[aria-current="true"]');
    await expect(current).toHaveAttribute('data-item', 'A1');
    await expect(selected).toHaveText('A1');
    await expect(page.locator('[data-position]')).toHaveText('row: 0, col: 0');
    await page.locator('[data-action="goto"]').click();
    await expect(current).toHaveAttribute('data-item', 'A10');
    await page.locator('[data-action="toggle"]').click();
    await page.locator('[data-action="toggle"]').click();
    await expect(current).toHaveAttribute('data-item', 'A1');
    await expect(selected).toHaveText('A1');
  });
}
