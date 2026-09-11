import {test,expect} from '@playwright/test';
test('Azure palette covers home, console and Fiber panels',async({page})=>{
 await page.goto('/'); await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');
 await page.getByRole('button',{name:/Dev Console/}).click();
 await expect(page.locator('.dev-console')).toHaveCSS('background-color','rgb(255, 255, 255)');
 await expect(page.locator('.dev-console header')).toHaveCSS('background-color','rgb(243, 242, 241)');
 await page.screenshot({path:'test-results/azure-colors-console.png'});
 await page.goto('/fiber-ops'); await expect(page.getByRole('heading',{name:'Network Operations Overview'})).toBeVisible();
 await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');
 await expect(page.locator('.ops-kpi-grid article').first()).toHaveCSS('background-color','rgb(250, 250, 250)');
 await expect(page.getByRole('button',{name:'Sync telemetry'})).toHaveCSS('background-color','rgb(255, 255, 255)');
 await expect(page.getByRole('button',{name:'Analyze route'})).toHaveCSS('background-color','rgb(243, 242, 241)');
 expect(await page.locator('.chain-health-ring').evaluate(el=>getComputedStyle(el,'::before').backgroundColor)).toBe('rgb(255, 255, 255)');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/azure-colors-fiber.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:/Dev Console/}).click();await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');
 await page.screenshot({path:'test-results/azure-colors-mobile.png'});
});
