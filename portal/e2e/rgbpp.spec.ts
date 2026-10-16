import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const sample=JSON.parse(readFileSync(new URL('../src/features/rgbpp/sample.json',import.meta.url),'utf8'));
test('checks public sample without a wallet and never claims proof verification',async({page})=>{
 await page.goto('/rgbpp');await page.getByText('Advanced / regression tools',{exact:true}).click();await page.getByRole('button',{name:'Open offline regression lab'}).click();await expect(page.getByRole('heading',{name:'RGB++ Inspector',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Check binding and commitment',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Linkage: matched',exact:true})).toBeVisible();
 await expect(page.getByText('Read-only · Proof: not verified · Transfer: not performed',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Refresh chain observations'})).toBeEnabled();
});
test('invalidates stale results after editing and rejects wrong vout',async({page})=>{
 await page.goto('/rgbpp');await page.getByText('Advanced / regression tools',{exact:true}).click();await page.getByRole('button',{name:'Open offline regression lab'}).click();await page.getByRole('button',{name:'Check binding and commitment',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Linkage: matched',exact:true})).toBeVisible();
 await page.getByText('Edit public fixture JSON',{exact:true}).click();
 await page.getByLabel('Public fixture JSON').fill(JSON.stringify({...sample,bitcoin:{...sample.bitcoin,vout:1}}));
 await expect(page.getByRole('heading',{name:'Linkage: matched',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Check binding and commitment',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Linkage: mismatch',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Refresh chain observations'})).toBeDisabled();
});
test('API outage renders unknown states and allows deliberate refresh',async({page})=>{
 await page.route('https://mempool.space/testnet/api/**',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.route('https://testnet.ckb.dev/**',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.goto('/rgbpp');await page.getByText('Advanced / regression tools',{exact:true}).click();await page.getByRole('button',{name:'Open offline regression lab'}).click();await page.getByRole('button',{name:'Check binding and commitment',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Linkage: matched',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Refresh chain observations'}).click();
 await expect(page.getByRole('heading',{name:'Chain observations',exact:true})).toBeVisible();
 await expect(page.locator('.rgbpp-chains pre')).toHaveCount(2);
 for(const block of await page.locator('.rgbpp-chains pre').all())await expect(block).toContainText('"state": "unknown"');
 await expect(page.getByRole('button',{name:'Refresh chain observations'})).toBeEnabled();
});
test('mobile layout remains usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/rgbpp');await page.getByText('Advanced / regression tools',{exact:true}).click();await page.getByRole('button',{name:'Open offline regression lab'}).click();
 await page.getByRole('button',{name:'Check binding and commitment',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Linkage: matched',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

