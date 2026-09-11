import {test,expect} from '@playwright/test';
test('desktop menu collapses, expands and remembers its setting',async({page})=>{
 await page.goto('/'); await expect(page.locator('#azure-navigation')).toBeVisible();
 const before=(await page.locator('main').boundingBox())!.width;
 await page.getByRole('button',{name:'Collapse navigation menu',exact:true}).click();
 await expect(page.locator('#azure-navigation')).toBeHidden();
 expect((await page.locator('main').boundingBox())!.width).toBeGreaterThan(before);
 await page.reload();await expect(page.getByRole('button',{name:'Expand navigation menu',exact:true})).toHaveAttribute('aria-expanded','false');
 await page.getByRole('button',{name:'Expand navigation menu',exact:true}).click();await expect(page.locator('#azure-navigation')).toBeVisible();
});
test('mobile drawer closes with Escape, backdrop and navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const toggle=page.locator('.azure-menu-toggle');await expect(toggle).toHaveAttribute('aria-expanded','false');
 await toggle.click();await expect(page.locator('#azure-navigation')).toBeVisible();
 await page.keyboard.press('Escape');await expect(toggle).toBeFocused();await expect(page.locator('#azure-navigation')).toBeHidden();
 await toggle.click();await page.getByRole('button',{name:'Close navigation menu',exact:true}).click({position:{x:370,y:200}});await expect(page.locator('#azure-navigation')).toBeHidden();
 await toggle.click();await page.locator('#azure-navigation').getByRole('link',{name:'Platform Overview',exact:true}).click();await expect(page).toHaveURL(/\/platform$/);await expect(page.locator('#azure-navigation')).toBeHidden();
 await toggle.click();await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');await page.screenshot({path:'test-results/azure-mobile-menu.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
