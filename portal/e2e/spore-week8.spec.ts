import {expect,test} from '@playwright/test';
test('DOB reads user IDs instead of substituting fixture attributes and exports scoped logs',async({page})=>{
 await page.goto('/dob-spore');await expect(page.getByRole('button',{name:'Decode fixture'})).toHaveCount(0);
 await page.getByLabel('DOB Spore ID').fill('invalid');await page.getByRole('button',{name:'Read DOB metadata and attributes'}).click();await expect(page.getByRole('alert')).toContainText('32 bytes');
 await page.getByRole('button',{name:/Dev Console · DOB \/ Spore/}).click();await expect(page.getByRole('log')).toContainText('Spore.readDob');await expect(page.getByRole('log')).not.toContainText('invalid');
});
test('Studio requires review and allows unique user DNA on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/dob-spore');await expect(page.getByRole('button',{name:'Confirm and sign'})).toHaveCount(0);
 await page.getByLabel(/Use pinned DOB\/0/).check();await page.getByRole('button',{name:'Generate unique DNA'}).click();const first=await page.getByLabel('DOB DNA (8 bytes hex)').inputValue();expect(first).toMatch(/^[0-9a-f]{16}$/);await page.getByRole('button',{name:'Generate unique DNA'}).click();expect(await page.getByLabel('DOB DNA (8 bytes hex)').inputValue()).not.toBe(first);
 await page.getByRole('button',{name:'Prepare Spore',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Connect a wallet');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
