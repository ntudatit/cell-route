import {test,expect} from '@playwright/test';
test('header actions remain usable at desktop, tablet and mobile widths',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');
 await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');
 await expect(page.locator('.topbar-secondary').getByRole('button',{name:'Authenticate API'})).toBeDisabled();
 await expect(page.locator('.topbar-secondary').getByRole('link',{name:'Help',exact:true})).toBeVisible();
 for(const width of [900,390,320]){
  await page.setViewportSize({width,height:844});
  const actions=page.getByRole('group',{name:'Account and workspace actions'});
  await expect(actions.getByRole('button',{name:'Connect wallet',exact:true})).toBeVisible();
  await page.getByLabel('More workspace actions',{exact:true}).click();
  await expect(page.locator('.topbar-popover')).toBeVisible();
  await expect(page.locator('.topbar-popover')).toContainText('CKB mainnet');
  await expect(page.locator('.topbar-popover').getByRole('button',{name:'Authenticate API'})).toBeDisabled();
  const box=(await page.locator('.topbar-popover').boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');await expect(page.locator('.topbar-popover')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.setViewportSize({width:390,height:844});await page.getByLabel('More workspace actions',{exact:true}).click();
 await page.screenshot({path:'test-results/topbar-actions-mobile.png'});
 await page.getByRole('heading',{name:'Welcome to CellRoute'}).click();await expect(page.locator('.topbar-popover')).toBeHidden();
 await page.getByRole('group',{name:'Account and workspace actions'}).getByRole('button',{name:'Connect wallet',exact:true}).click();await expect(page.getByRole('button',{name:/JoyID Passkey/})).toBeVisible();
});
