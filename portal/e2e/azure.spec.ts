import { test, expect } from '@playwright/test';
test('Azure-inspired workspace service directory', async ({page})=>{
 await page.goto('/'); await expect(page.getByRole('heading',{name:'Welcome to CellRoute'})).toBeVisible();
 await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');
 await page.getByRole('tab',{name:'Favorites',exact:true}).click(); await expect(page.locator('.azure-table tbody tr')).toHaveCount(2);
 await page.getByRole('button',{name:'Favorite Wallet',exact:true}).click(); await expect(page.locator('.azure-table tbody tr')).toHaveCount(1);
 await expect(page.getByLabel('Search services',{exact:true})).toHaveCount(0); await expect(page.getByLabel('Filter services')).toHaveCount(0);
 await page.evaluate(()=>window.scrollTo(0,0)); await expect(page.locator('.azure-header')).toHaveCSS('top','0px');
 await page.screenshot({path:'test-results/azure-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>window.scrollTo(0,0)); await page.screenshot({path:'test-results/azure-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
