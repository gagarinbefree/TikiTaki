import { expect, test } from '@playwright/test';

for (const framework of ['react', 'vue', 'svelte']) {
  test(`${framework} starts at A1 and supports map selection after reload`, async ({ page }) => {
    await page.goto(`/demos/${framework}/`);
    const current = page.locator('[data-tikitaki-role="current"] [data-item]');
    const selected = page.locator('[aria-current="true"]');
    await expect(current).toHaveAttribute('data-item', 'A1');
    await expect(selected).toHaveText('A1');
    await page.getByRole('button', { name: 'A10', exact: true }).click();
    await expect(current).toHaveAttribute('data-item', 'A10');
    await page.reload();
    await expect(current).toHaveAttribute('data-item', 'A1');
    await expect(selected).toHaveText('A1');
  });
}
