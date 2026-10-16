import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
test('Simple Lock requires an explicit deployment manifest before exposing transaction controls',async({page})=>{
 await page.goto('/simple-lock');await expect(page.getByRole('heading',{name:'Simple Lock Lab',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Submit unlock',exact:true})).toHaveCount(0);
 await page.getByLabel('Deployment manifest JSON').setInputFiles({name:'deployment.json',mimeType:'application/json',buffer:readFileSync(new URL('../public/simple-lock.devnet.json',import.meta.url))});
 await expect(page.getByLabel('Preimage (UTF-8, kept in memory)')).toBeVisible();await expect(page.getByRole('button',{name:'Submit unlock',exact:true})).toBeDisabled();await expect(page.getByLabel('Stored digest')).toHaveValue('');
});
