import { chromium,expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir,readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
const url=process.env.RAILPLAN_URL??process.env.E2E_URL??'http://127.0.0.1:3120';
if(!['localhost','127.0.0.1'].includes(new URL(url).hostname)||!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('Use an isolated local test database.');
assert.equal(process.env.RUN_E2E,'1','Explicit RUN_E2E=1 is required');
const sql=new pg.Client({connectionString:process.env.DATABASE_URL});await sql.connect();await sql.query('TRUNCATE "User", "AppSettings", "RateLimitBucket" CASCADE');await sql.end();
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL??(process.env.CI?undefined:'chrome'),headless:true});const a=await browser.newContext({acceptDownloads:true}),b=await browser.newContext();const page=await a.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await mkdir('build/railplan-qa',{recursive:true});
const email=`rail-${randomUUID()}@example.invalid`,password=`Railplan!${randomUUID()}`;
async function signup(context,email){const response=await context.request.post(`${url}/api/auth/signup`,{headers:{Origin:url},data:{name:'Railplan test',email,password}});assert.equal(response.status(),201,await response.text());}
// Secure session cookies are sent by Chromium on loopback; API probes attach them explicitly.
const probe=async(context,path,method='get',data)=>context.request[method](`${url}${path}`,{headers:{Origin:url,Cookie:(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ')},data});
const api=(path,method='get',data)=>probe(a,path,method,data);
const nav=name=>page.getByRole('button',{name,exact:true}).click();
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());const date=new Date(new Date(`${today}T00:00:00Z`).getTime()+70*86400000).toISOString().slice(0,10);
try{
  assert.equal((await probe(b,'/api/railplan/workspace')).status(),401);
  for(const path of ['/rebuild','/design-preview','/today','/trips','/api/journeys','/api/internal/pnr-sync'])assert.equal((await b.request.get(url+path)).status(),404,'Retired route '+path);
  await page.goto(url);await page.getByLabel('Name',{exact:true}).fill('Railplan test');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Create administrator',exact:true}).click();await expect(page).toHaveURL(url+'/railplan');await signup(b,`other-${randomUUID()}@example.invalid`);
  await page.goto(`${url}/railplan`);await page.getByRole('heading',{name:'Your travel, in view'}).waitFor();
  await nav('New journey');const dialog=()=>page.getByRole('dialog');await dialog().getByLabel('From',{exact:true}).fill('Madurai');await dialog().getByLabel('To',{exact:true}).fill('Chennai');await dialog().getByLabel('Travel date').fill(date);await dialog().getByRole('button',{name:'Save journey',exact:true}).click();await expect(dialog()).toHaveCount(0);await page.getByRole('status').filter({hasText:'Journey saved'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('railplan.rebuild.v1')),null);
  let state=(await(await api('/api/railplan/workspace')).json()).data;assert.equal(state.planner.journeys.length,1);assert.equal((await(await probe(b,'/api/railplan/workspace')).json()).data.planner.journeys.length,0);
  await nav('My journeys');await page.getByRole('region',{name:'To book column'}).getByRole('article').dragTo(page.getByRole('region',{name:'Booked column'}).getByRole('heading',{name:'Booked',exact:true}));await expect(page.getByRole('region',{name:'Booked column'}).getByRole('article')).toHaveCount(1);assert.equal(await dialog().count(),0);
  await page.getByRole('button',{name:/Open journey/}).click();await dialog().getByLabel('Train number',{exact:true}).fill('12637');await dialog().getByLabel('Train name',{exact:true}).fill('Pandian Express');await dialog().getByLabel('PNR',{exact:true}).fill('1234567890');
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');await dialog().getByLabel('Upload ticket PDF or QR image').setInputFiles({name:'stored-ticket.pdf',mimeType:'application/pdf',buffer:pdf});await expect(dialog().getByRole('button',{name:'Save journey',exact:true})).toBeEnabled({timeout:30000});await dialog().getByRole('button',{name:'Save journey',exact:true}).click();await expect(dialog()).toHaveCount(0);
  state=(await(await api('/api/railplan/workspace')).json()).data;const file=state.planner.journeys[0].attachments[0];assert.ok(file);assert.equal((await probe(b,`/api/railplan/files/${file.id}`)).status(),404);
  const foreign=(await(await probe(b,'/api/railplan/workspace')).json()).data;foreign.planner.journeys=state.planner.journeys;assert.equal((await probe(b,'/api/railplan/workspace','put',foreign)).status(),400);
  assert.equal((await api(`/api/railplan/files/${file.id}`,'delete')).status(),409);
  await page.reload();await nav('Ticket vault');await expect(page.getByRole('article')).toHaveCount(1);let download=page.waitForEvent('download');await nav('Download');await(await download).saveAs('build/railplan-qa/download.pdf');assert.deepEqual(await readFile('build/railplan-qa/download.pdf'),pdf);
  const fresh=await browser.newContext({storageState:await a.storageState()});const p2=await fresh.newPage();await p2.goto(`${url}/railplan`);await p2.getByRole('button',{name:'Ticket vault',exact:true}).click();await expect(p2.getByRole('article')).toHaveCount(1);await fresh.close();
  // Version checks reject writes from an older tab without clobbering current plans.
  const stale=state;state.planner.journeys[0].notes='Latest server note';assert.equal((await api('/api/railplan/workspace','put',state)).status(),200);assert.equal((await api('/api/railplan/workspace','put',stale)).status(),409);
  await nav('Open journey');await dialog().getByLabel('Notes',{exact:true}).fill('Unsaved conflicting change');await dialog().getByRole('button',{name:'Save journey',exact:true}).click();await expect(dialog().getByRole('alert')).toContainText('another session');assert.equal(await dialog().getByLabel('Notes',{exact:true}).inputValue(),'Unsaved conflicting change');await page.keyboard.press('Escape');await page.reload();
  await nav('Settings');await expect(page.getByText('Waiting for the administrator',{exact:false})).toBeVisible();assert.equal((await api('/api/railplan/google/connect','post')).status(),503);
  assert.equal((await a.request.post(`${url}/api/internal/railplan/process`)).status(),401);
  const worker=await a.request.post(`${url}/api/internal/railplan/process`,{headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`}});assert.equal(worker.status(),200,await worker.text());
  await expect.poll(async()=>Math.round((await page.locator('aside').boundingBox()).width)).toBe(240);await page.screenshot({path:'build/railplan-qa/account-settings.png',fullPage:true,animations:'disabled'});await nav('My journeys');await expect.poll(async()=>Math.round((await page.locator('aside').boundingBox()).width)).toBe(240);await page.screenshot({path:'build/railplan-qa/account-board.png',fullPage:true,animations:'disabled'});await nav('Sign out');await expect(page).toHaveURL(`${url}/`);assert.equal((await a.request.get(`${url}/api/railplan/workspace`)).status(),401);
  assert.deepEqual(errors,[]);console.log('Passed: authenticated account app, remote saves, status moves, encrypted ticket persistence across browsers, tenant isolation, attachment ownership, optimistic conflicts, configuration gating, worker authentication, and logout.');
}catch(e){await page.screenshot({path:'build/railplan-qa/failure.png',fullPage:true});throw e;}finally{await browser.close();}

