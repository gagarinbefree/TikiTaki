import { expect, test } from '@playwright/test';

for (const framework of ['react', 'vue']) {
  test(`Pages project path opens the ${framework} demo with working assets and cell selection`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    const response = await page.goto('/TikiTaki/');
    expect(response?.status()).toBe(200);
    await page.getByRole('link', { name: framework === 'react' ? 'React / StrictMode' : 'Vue 3 / Composition API' }).click();
    await expect(page).toHaveURL(new RegExp(`/TikiTaki/${framework}/$`));
    const current = page.locator('[data-tikitaki-role="current"]');
    await expect(current.locator('[data-item]')).toHaveAttribute('data-item', 'A10');
    await expect(page.locator('[data-demo-container]')).toHaveCSS('touch-action', 'none');
    await page.getByRole('button', { name: 'C3', exact: true }).click();
    await expect(current.locator('[data-item]')).toHaveAttribute('data-item', 'C3');
    await expect(page.locator('[aria-current="true"]')).toHaveText('C3');
    const geometry = await current.boundingBox();
    expect(geometry?.height).toBeGreaterThan(100);
    await page.getByRole('link', { name: '← Все demos' }).click();
    await expect(page).toHaveURL(/\/TikiTaki\/$/);
    expect(errors).toEqual([]);
  });
}
