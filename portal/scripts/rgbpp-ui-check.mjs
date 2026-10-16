import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.goto('http://127.0.0.1:4190/rgbpp');
 await page.getByText('Advanced / regression tools',{exact:true}).click();await page.getByRole('button',{name:'Open offline regression lab'}).click();
 await page.getByRole('button',{name:'Check binding and commitment',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Linkage: matched',exact:true})).toBeVisible();
 await expect(page.locator('.project-loading')).toHaveAttribute('aria-hidden','true');
 await expect(page.locator('.project-loading')).toHaveCSS('opacity','0');
 await page.screenshot({path:'../docs/evidence/week-10/inspector.png'});
 await page.getByRole('button',{name:'Refresh chain observations'}).click();
 await page.getByRole('heading',{name:'Chain observations',exact:true}).waitFor({timeout:55000});
 await expect(page.getByText('Read-only · Proof: not verified · Transfer: not performed',{exact:true})).toHaveCount(1);
 await page.getByRole('heading',{name:'Chain observations',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'../docs/evidence/week-10/observations.png'});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export public receipt',exact:true}).click();
 const file=await download;const receipt=JSON.parse(await readFile(await file.path(),'utf8'));
 if(receipt.linkage.status!=='matched'||receipt.observation.proof.status!=='not verified'||receipt.observation.crossChainComplete!==false)throw Error('Invalid public receipt status');
 await page.getByRole('button',{name:/Dev Console/}).click();
 await expect(page.getByText(/testnet · Live/)).toBeVisible();
 await page.screenshot({path:'../docs/evidence/week-10/console.png'});
 await writeFile('../docs/evidence/week-10/browser-check.json',JSON.stringify({checkedAt:new Date().toISOString(),browser:'installed Edge through Playwright',layer:'actual browser against public APIs; no HTTP mocks',linkage:receipt.linkage.status,proof:receipt.observation.proof,bitcoin:receipt.observation.bitcoin,ckb:receipt.observation.ckb,consoleNetwork:'testnet',export:'public receipt parsed successfully'},null,2)+'\n');
 console.log('PASS: actual browser decoded the sample, read APIs, exported receipt and displayed Testnet console.');
} finally { await browser.close(); }

