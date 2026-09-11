import {test,expect} from '@playwright/test';
test('landing offers clear actions and remembers favorites',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Welcome to CellRoute'})).toBeVisible();
 await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');
 await page.getByRole('link',{name:'Browse services',exact:true}).click();await expect(page).toHaveURL(/#service-directory$/);
 await page.getByRole('button',{name:'Favorite Wallet',exact:true}).click();await page.reload();
 await expect(page.getByRole('button',{name:'Favorite Wallet',exact:true})).toHaveAttribute('aria-pressed','false');
 await page.getByLabel('Filter services').fill('no match');await expect(page.getByRole('heading',{name:'No services match your search'})).toBeVisible();
 await page.getByRole('button',{name:'Show all services'}).click();await expect(page.locator('.azure-table tbody tr')).toHaveCount(9);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/landing-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/landing-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.locator('.home-hero').getByRole('button',{name:'Connect wallet'}).click();await expect(page.getByRole('button',{name:/JoyID Passkey/})).toBeVisible();
});
test('protected service opens wallet selection from landing',async({page})=>{
 await page.goto('/wallet');await expect(page).toHaveURL(/connect=1/);await expect(page.getByRole('button',{name:/JoyID Passkey/})).toBeVisible();
});
