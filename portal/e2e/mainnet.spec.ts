import { test, expect } from '@playwright/test';
test('mainnet build shows the selected chain and keeps the lab inactive', async ({ page }) => {
  const broadcasts: string[] = [];
  page.on('request', request => { if (request.postData()?.includes('send_transaction')) broadcasts.push(request.url()); });
  await page.goto('/simple-lock');
  await expect(page.getByRole('heading', { name: 'Simple Lock is a Devnet lab' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('CKB Mainnet');
  await expect(page.getByRole('button', { name: 'Submit unlock' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Testnet Faucet' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Simple Lock Lab' })).toHaveCount(0);
  expect(broadcasts).toEqual([]);
  await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('button', { name: /Dev Console · Simple Lock Lab/ }).click();
  const consolePanel = page.getByRole('region', { name: 'Simple Lock Lab developer console' });
  await expect(consolePanel).toContainText('mainnet · Live');
  await expect(consolePanel.getByRole('log')).toContainText('CKB.getTipHeader');
  await page.screenshot({ path: 'test-results/mainnet.png', fullPage: true });
});

