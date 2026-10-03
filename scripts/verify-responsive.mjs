import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { expect } from '@playwright/test';

/** Exercises the populated test account at phone, tablet and desktop widths in both themes. */
export async function verifyResponsive({page,api,url,otherApi}) {
  const curve=createECDH('prime256v1');curve.generateKeys();
  const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/railwatch-isolated-test',keys:{p256dh:curve.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
  assert.equal((await api('/api/railwatch/push','post',{action:'subscribe',subscription})).status(),200);
  assert.equal((await(await api('/api/railwatch/push','post',{action:'status',endpoint:subscription.endpoint})).json()).data.subscribed,true);
  assert.equal((await api('/api/railwatch/push','post',{action:'subscribe',subscription:{...subscription,endpoint:'https://localhost/private'}})).status(),400);
  assert.equal((await otherApi('/api/railwatch/push','post',{action:'subscribe',subscription})).status(),409);
  assert.equal((await otherApi('/api/railwatch/push','post',{action:'test',endpoint:subscription.endpoint})).status(),400);
  assert.equal((await api('/api/railwatch/push','post',{action:'remove',endpoint:subscription.endpoint})).status(),200);
  for (const theme of ['light','dark']) {
    const state=(await(await api('/api/railwatch/workspace')).json()).data;
    state.planner.settings.theme=theme;
    assert.equal((await api('/api/railwatch/workspace','put',state)).status(),200);
    for (const width of [320,390,768,1482]) {
      await page.setViewportSize({width,height:844});
      for (const path of ['/','/journeys','/calendar','/routines','/holidays','/tickets','/admin','/admin/operations','/notifications']) {
        await page.goto(url+path);
        await page.getByRole('heading',{level:1}).waitFor();
        await expect(page.locator('[data-theme]')).toHaveAttribute('data-theme',theme);
        const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(dimensions.scroll<=dimensions.width+1,`${theme} ${width}px ${path}: document overflows`);
      }
      if(width<=390) {
        await page.goto(url+'/journeys');
        for(const name of ['Dashboard','My Journeys','Calendar']) {
          const link=page.getByRole('link',{name,exact:true});await expect(link).toBeVisible();
          const box=await link.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,`Mobile ${name} fits`);
        }
        await expect(page.getByRole('region',{name:'Booked column',exact:true})).toBeVisible();
        await expect(page.getByRole('region',{name:'Planned column',exact:true})).toBeHidden();
        if(width===390)await page.screenshot({path:`build/railwatch-qa/mobile-board-${theme}.png`,animations:'disabled'});
        await page.getByRole('button',{name:/^Planned \d+/}).click();
        await expect(page.getByRole('region',{name:'Planned column',exact:true})).toBeVisible();
        await page.getByRole('button',{name:'More',exact:true}).click();
        const more=page.getByRole('dialog',{name:'More',exact:true});await expect(more.getByRole('link',{name:'Ticket Vault',exact:true})).toBeVisible();
        await more.getByRole('link',{name:'Routines',exact:true}).click();await expect(more).toHaveCount(0);
        await page.getByRole('button',{name:'Open Profile Menu',exact:true}).click();await page.getByRole('menuitem',{name:'User Settings',exact:true}).click();
        const drawer=page.getByRole('dialog',{name:'User Settings',exact:true});
        const bounds=await drawer.boundingBox();for(const tab of await drawer.getByRole('tab').all()){const box=await tab.boundingBox();assert.ok(box.x>=bounds.x&&box.x+box.width<=bounds.x+bounds.width+1,'Settings tabs fit phone');}
        await drawer.getByRole('button',{name:'Close User Settings',exact:true}).click();
        await page.goto(url+'/journeys');await page.getByRole('region',{name:'Booked column',exact:true}).getByRole('button',{name:/Open journey/}).first().click();
        const summary=page.getByRole('dialog');await expect(summary.getByRole('button',{name:'Edit Journey',exact:true})).toBeVisible();await expect(summary.getByRole('textbox')).toHaveCount(0);await summary.getByRole('button',{name:'Close Dialog',exact:true}).click();
        await page.getByRole('button',{name:'Open Profile Menu'}).click();await page.getByRole('menuitem',{name:'User Settings'}).click();await drawer.getByRole('tab',{name:'Preferences',exact:true}).click();await expect(drawer.getByRole('heading',{name:'Normal Booking Reminders'})).toBeVisible();
        assert.ok(await drawer.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Custom reminder controls fit mobile');await drawer.getByRole('button',{name:'Close User Settings',exact:true}).click();

        await page.getByRole('button',{name:/^Notifications/}).click();
        const inbox=page.getByRole('region',{name:'Notifications',exact:true});
        const panel=await inbox.boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=width,'Notification inbox fits phone');
        await inbox.getByRole('button',{name:/Close/}).click();
        await page.goto(url+'/calendar');await page.getByRole('button',{name:'Agenda',exact:true}).click();await expect(page.getByRole('region',{name:'Month agenda',exact:true})).toBeVisible();
        await page.goto(url+'/');await page.getByRole('heading',{level:1}).waitFor();await expect(page.locator('[data-theme]')).toHaveAttribute('data-theme',theme);await page.screenshot({path:`build/railwatch-qa/mobile-${width}-${theme}.png`,animations:'disabled'});
      }
    }
  }
  await page.setViewportSize({width:1482,height:876});
  const state=(await(await api('/api/railwatch/workspace')).json()).data;state.planner.settings.theme='light';assert.equal((await api('/api/railwatch/workspace','put',state)).status(),200);
  await page.goto(url+'/journeys');await page.getByRole('region',{name:'Booked column',exact:true}).getByRole('button',{name:/Open journey/}).first().click();
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Edit Journey',exact:true})).toHaveCount(0);await expect(dialog.getByLabel('Notes',{exact:true})).toBeVisible();
  assert.ok((await dialog.boundingBox()).width>1000,'Desktop journey opens directly in editor');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden','Dialog owns scrolling');
  await dialog.getByLabel('Notes',{exact:true}).fill('Discard guard test');
  page.removeAllListeners('dialog');let warned=false;page.on('dialog',async d=>{warned=true;await d.dismiss();});
  await dialog.getByRole('button',{name:'Close Dialog',exact:true}).click();assert.equal(warned,true);await expect(dialog).toBeVisible();
  page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());await dialog.getByRole('button',{name:'Close Dialog',exact:true}).click();await expect(dialog).toHaveCount(0);

  await page.getByRole('button',{name:'New Journey',exact:true}).click();
  await dialog.getByRole('combobox',{name:'Booking type',exact:true}).click();await dialog.getByRole('option',{name:'Tatkal',exact:true}).click();
  await expect(dialog.getByText('10:00 AM IST',{exact:false})).toBeVisible();
  await dialog.getByRole('combobox',{name:'Tatkal class',exact:true}).click();await dialog.getByRole('option',{name:'Non-AC — opens at 11 AM',exact:true}).click();await expect(dialog.getByText('11:00 AM IST',{exact:false})).toBeVisible();
  await dialog.getByRole('button',{name:'Close Dialog',exact:true}).click();
  await page.goto(url+'/journeys');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{window.viewMotionCalls=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){window.viewMotionCalls.push({frames,options});return original.call(this,frames,options);};});
  await page.getByRole('button',{name:/^History/}).click();
  await expect.poll(()=>page.evaluate(()=>window.viewMotionCalls.length)).toBeGreaterThan(0);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{window.viewMotionCalls=[];});
  await page.getByRole('button',{name:/^Archive \d/}).click();assert.equal(await page.evaluate(()=>window.viewMotionCalls.length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto(url+'/');await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href','/manifest.webmanifest');
  const manifest=await(await page.request.get(url+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  const cache=await page.evaluate(async()=>{const keys=await caches.keys();return Promise.all(keys.filter(key=>key.startsWith('railwatch-')).map(async key=>(await(await caches.open(key)).keys()).map(request=>new URL(request.url).pathname)));});
  assert.deepEqual(cache.flat(),['/offline.html']);
  await page.context().setOffline(true);await page.goto(url+'/journeys');await expect(page.getByRole('heading',{name:'You’re offline',exact:true})).toBeVisible();await page.context().setOffline(false);await page.goto(url+'/');
  console.log('Passed: responsive routes in light/dark themes, visible mobile navigation, status columns, More menu, settings tabs, agenda, unsaved-change guard, standalone manifest and offline-only cache.');
}
