import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
const captured=JSON.parse(readFileSync(new URL('../../docs/evidence/live-labs/rgbpp-mainnet-cell.json',import.meta.url),'utf8'));
test('live RGB++ starts empty and reads a user OutPoint with local Merkle checks',async({page})=>{
 await page.route('https://mainnet.ckb.dev/**',async route=>{const q=route.request().postDataJSON();const stored=captured.raw.find((r:any)=>typeof r.request==='object'&&r.request.method===q.method&&JSON.stringify(r.request.params)===JSON.stringify(q.params));if(stored)return route.fulfill({json:{...stored.response,id:q.id}});return route.fulfill({status:503,body:'No replay response'});});
 await page.route('https://mempool.space/api/**',async route=>{const path=route.request().url().slice('https://mempool.space/api'.length);const stored=captured.raw.find((r:any)=>r.request===path);return route.fulfill(stored?{body:stored.response,contentType:'text/plain'}:{status:503,body:'No replay'});});
 await page.goto('/rgbpp');await expect(page.getByRole('button',{name:'Inspect asset',exact:true})).toBeDisabled();await expect(page.getByText('Official public sample',{exact:true})).toHaveCount(0);
 await page.getByLabel('Network pair').selectOption('mainnet');await page.getByLabel('CKB transaction hash').fill(captured.query.txid);await page.getByRole('button',{name:'Inspect asset',exact:true}).click();await expect(page.getByRole('heading',{name:'Live asset results',exact:true})).toBeVisible();await expect(page.locator('.rgbpp-chains pre').first()).toContainText('"status": "matched"');
 await page.getByLabel('CKB transaction hash').fill('00'.repeat(32));await expect(page.getByRole('heading',{name:'Live asset results',exact:true})).toHaveCount(0);
});
test('SSRI requires a real deployment and service URL rather than a prototype identity',async({page})=>{await page.goto('/ssri');await expect(page.getByLabel('codeHash',{exact:true})).toHaveValue('');await expect(page.getByLabel('Code transaction hash')).toHaveValue('');await expect(page.getByLabel('serverUrl',{exact:true})).toHaveValue('');await expect(page.getByLabel('Method signature')).toHaveValue('UDT.name');});
