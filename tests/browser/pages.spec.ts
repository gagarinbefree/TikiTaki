import { expect, test } from '@playwright/test';

test('all Pages entry points link to the repository and npm without a release version', async ({ page }) => {
  await page.route('**/version.json', (route) => route.fulfill({ json: { version: '0.1.1' } }));
  for (const entry of ['', 'vanilla/', 'react/', 'vue/', 'svelte/', 'angular/', 'lit/']) {
    await page.goto(`/TikiTaki/${entry}`);
    await expect(page.locator('[data-demo-repository]')).toHaveAttribute('href', 'https://github.com/gagarinbefree/TikiTaki');
    await expect(page.locator('[data-demo-repository]')).toHaveText('GitHub');
    await expect(page.locator('[data-demo-npm]')).toHaveText('npm');
    await expect(page.locator('[data-demo-npm]')).toHaveAttribute('href', 'https://www.npmjs.com/package/tikitaki');
    await expect(page.locator('[data-demo-version]')).toHaveCount(0);
  }
});

for (const framework of ['vanilla', 'react', 'vue', 'svelte', 'angular', 'lit'] as const) {
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
    await expect(page.locator('main > section .btn-outline').first()).toHaveText('Vanilla JS');
    const link = page
      .locator('main > section')
      .getByRole('link', {
        name: { vanilla: 'Vanilla JS', react: 'React', vue: 'Vue', svelte: 'Svelte', angular: 'Angular', lit: 'Lit' }[framework],
        exact: true,
      });
    await expect(link).toHaveClass('btn-outline theme-secondary');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/TikiTaki/${framework}/$`));
    const current = page.locator('[data-tikitaki-role="current"]');
    await expect(current.locator('[data-item]')).toHaveAttribute('data-item', 'A1');
    await expect(page.locator('[data-demo-container]')).toHaveCSS('touch-action', 'none');
    await page.getByRole('button', { name: 'C3', exact: true }).click();
    await expect(current.locator('[data-item]')).toHaveAttribute('data-item', 'C3');
    await expect(page.locator('[aria-current="true"]')).toHaveText('C3');
    const geometry = await current.boundingBox();
    expect(geometry?.height).toBeGreaterThan(100);
    if ((page.viewportSize()?.width ?? 0) < 768) await page.goto('/TikiTaki/');
    else await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await expect(page).toHaveURL(/\/TikiTaki\/$/);
    expect(errors).toEqual([]);
  });
}
