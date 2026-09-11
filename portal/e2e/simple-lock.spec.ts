import { test, expect } from '@playwright/test';
test('Simple Lock Lab derives an address without connecting a wallet', async ({ page }) => {
  await page.goto('/simple-lock');
  await expect(page.getByRole('heading', { name: 'Simple Lock Lab', exact: true })).toBeVisible();
  await page.getByLabel('Preimage (UTF-8, kept in memory)').fill('CellRoute Week 5');
  await page.getByRole('button', { name: 'Derive from preimage' }).click();
  await expect(page.getByLabel('Stored digest')).toHaveValue(/^0x[0-9a-f]{64}$/);
  await expect(page.getByText(/^offckb deposit ckt1/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit unlock', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/simple-lock-lab.png', fullPage: true });
});
