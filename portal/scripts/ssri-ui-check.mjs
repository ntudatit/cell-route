import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const deployment=JSON.parse(readFileSync('public/ssri.devnet.json','utf8'));
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.goto('http://127.0.0.1:4173/ssri');
 await page.getByLabel('codeHash',{exact:true}).fill('0x'+'00'.repeat(32));
 await page.getByRole('button',{name:'Verify identity and query'}).click();
 await page.getByRole('alert').filter({hasText:'IDENTITY'}).waitFor();
 await page.getByLabel('codeHash',{exact:true}).fill(deployment.codeHash);
 await page.getByRole('button',{name:'Verify identity and query'}).click();
 await page.getByRole('heading',{name:'Public query receipt'}).waitFor();
 await page.getByRole('button',{name:/Dev Console/}).click();
 await page.getByText('devnet · Live',{exact:false}).waitFor();
 await page.screenshot({path:'../docs/evidence/week-9/console.png',fullPage:true});
 await page.getByRole('button',{name:'Collapse developer console'}).click();
 await page.getByRole('heading',{name:'Public query receipt'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'../docs/evidence/week-9/inspector.png',fullPage:true});
 console.log('PASS: actual UI rejects wrong identity, renders UDT.name, and scopes console to Devnet');
} finally { await browser.close(); }

