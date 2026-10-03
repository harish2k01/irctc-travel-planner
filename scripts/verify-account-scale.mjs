import assert from 'node:assert/strict';
import {expect} from '@playwright/test';

/** Exercise bounded lists and edits beyond the first page without losing existing plans. */
export async function verifyAccountScale({page,api,url}) {
  const baseline=(await (await api('/api/railwatch/workspace')).json()).data;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
  const journeys=Array.from({length:210},(_,i)=>({id:`scale-ui-${i}`,from:`ScaleOrigin${i}`,to:'ScaleDestination',date:new Date(Date.parse(today+'T00:00:00Z')+(90+i)*86400000).toISOString().slice(0,10),departure:'20:00',train:'',travelClass:'',windowDays:60,originOffset:0,status:'needs_booking',pnr:'',notes:'Preserve this record'}));
  try {
    assert.equal((await api('/api/railwatch/workspace','put',{...baseline,planner:{...baseline.planner,journeys:[...baseline.planner.journeys,...journeys]}})).status(),200);
    const partial=(await (await api('/api/railwatch/workspace?partial=1')).json()).data;
    assert.equal(partial.partial,true);assert.equal(partial.planner.journeys.length,0);
    await page.goto(url+'/journeys');
    const column=page.getByRole('region',{name:'Planned column',exact:true});
    await expect(column.getByRole('article')).toHaveCount(30);
    await column.getByRole('button',{name:'Load more planned',exact:true}).click();
    await expect(column.getByRole('article')).toHaveCount(60);
    await page.getByRole('textbox',{name:'Search Journeys',exact:true}).fill('ScaleOrigin209');
    await expect(column.getByRole('article')).toHaveCount(1);
    await column.getByRole('button',{name:/Open journey/}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Notes',{exact:true}).fill('Edited beyond the first page');
    await dialog.getByRole('button',{name:/^Save journey$/i}).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async()=>((await (await api('/api/railwatch/workspace')).json()).data.planner.journeys.find(j=>j.id==='scale-ui-209')?.notes)).toBe('Edited beyond the first page');
    const saved=(await (await api('/api/railwatch/workspace')).json()).data;
    for(const journey of journeys)assert.equal(saved.planner.journeys.find(j=>j.id===journey.id)?.notes,journey.id==='scale-ui-209'?'Edited beyond the first page':'Preserve this record');
    for(const journey of baseline.planner.journeys)assert.ok(saved.planner.journeys.some(j=>j.id===journey.id));
    await page.getByRole('textbox',{name:'Search Journeys',exact:true}).fill('');
    await expect(column.getByRole('article')).toHaveCount(30);
    await page.screenshot({path:'build/railwatch-qa/account-scale-board.png',animations:'disabled'});
  } finally {
    const current=(await (await api('/api/railwatch/workspace')).json()).data;
    assert.equal((await api('/api/railwatch/workspace','put',{planner:baseline.planner,revision:current.revision})).status(),200);
  }
}
