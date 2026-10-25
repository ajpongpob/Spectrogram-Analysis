import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const rate=44100,seconds=4,wav=Buffer.alloc(44+rate*seconds*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
for(let i=0;i<rate*seconds;i++)wav.writeInt16LE(Math.round((Math.sin(2*Math.PI*440*i/rate)+.4*Math.sin(2*Math.PI*660*i/rate))*13000),44+i*2);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
await fs.mkdir('test-results',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8954/');await page.locator('[data-language=en]').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.screenshot({path:'test-results/landing-en.png'});
 await page.locator('#file-input').setInputFiles({name:'Object study.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>document.querySelector('#percent').textContent==='100%',{timeout:60000});
 let viewer=page.frames().find(f=>f.url().includes('/viewer.html'));
 assert.equal(await viewer.locator('html').getAttribute('lang'),'en');assert.equal(await viewer.locator('#status').textContent(),'Ready');
 const saved=()=>viewer.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.endsWith(':annotations:v1')))||'[]'));
 const state=()=>viewer.evaluate(()=>viewerTest.state);
 async function drag(x1,y1,x2,y2){await viewer.locator('#plot').scrollIntoViewIfNeeded();const b=await viewer.locator('#plot').boundingBox();await page.mouse.move(b.x+x1,b.y+y1);await page.mouse.down();await page.mouse.move(b.x+x2,b.y+y2,{steps:10});await page.mouse.up()}
 const settle=()=>viewer.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await viewer.locator('#lab-button-draw').click();assert.equal(await viewer.locator('#tool').inputValue(),'select');
 await viewer.locator('#tool').selectOption('rect');await viewer.locator('#penWidthNumber').fill('1.25');await viewer.locator('#penWidthNumber').press('Tab');await viewer.locator('[data-color="#0ea5e9"]').click();
 await drag(200,80,390,190);let items=await saved();assert.equal(items.length,1);assert.equal(items[0].color,'#0ea5e9');assert.equal(items[0].width,1.25);assert.equal(await viewer.locator('#tool').inputValue(),'select');
 const original=items[0];await drag(260,130,320,160);items=await saved();assert(items[0].points[0].t>original.points[0].t);assert(items[0].points[0].m<original.points[0].m);const moved=items[0];
 await viewer.locator('#plot').press('Control+z');assert.deepEqual((await saved())[0],original);await viewer.locator('#plot').press('Control+Shift+z');assert.deepEqual((await saved())[0],moved);
 await viewer.locator('#plot').press('Meta+c');await viewer.locator('#plot').press('Meta+v');assert.equal((await saved()).length,2);assert.notDeepEqual((await saved())[1].points,moved.points);
 await viewer.locator('#plot').press('Delete');assert.equal((await saved()).length,1);await viewer.locator('#undo').click();assert.equal((await saved()).length,2);
 await viewer.locator('#copyObject').click();await viewer.locator('#pasteObject').click();assert.equal((await saved()).length,3);await viewer.locator('#deleteObject').click();assert.equal((await saved()).length,2);
 await viewer.locator('#tool').selectOption('text');await viewer.locator('#annotationText').fill('ท่อน A\nMelody');await viewer.locator('#textSize').fill('22');await viewer.locator('#plot').click({position:{x:480,y:90}});assert.equal((await saved()).length,3);
 await viewer.locator('#annotationText').fill('ท่อน B\nMelody 2');await viewer.locator('#annotationText').press('Tab');await viewer.locator('[data-color="#8b5cf6"]').click();assert.equal((await saved())[2].text,'ท่อน B\nMelody 2');assert.equal((await saved())[2].color,'#8b5cf6');
 const clipboard=await viewer.evaluate(()=>sessionStorage.getItem('muspec-object-clipboard'));await viewer.locator('#annotationText').focus();await viewer.locator('#annotationText').press('Control+a');await viewer.locator('#annotationText').press('Control+c');assert.equal(await viewer.evaluate(()=>sessionStorage.getItem('muspec-object-clipboard')),clipboard,'Text editing shortcuts must not copy an annotation object');
 const textOriginal=(await saved())[2];await drag(500,110,450,140);assert.notDeepEqual((await saved())[2].points,textOriginal.points);
 const beforeLanguage=await saved(),beforeView=await state();await viewer.locator('[data-language=th]').click();await page.waitForFunction(()=>document.documentElement.lang==='th');assert.equal(await viewer.locator('#lab-button-draw').getAttribute('aria-label'),'เขียนกำกับ');assert.deepEqual(await saved(),beforeLanguage);assert.deepEqual(await state(),beforeView);
 await page.locator('[data-language=en]').click();await viewer.waitForFunction(()=>document.documentElement.lang==='en');assert.deepEqual(await saved(),beforeLanguage);
 const thaiStatic=await viewer.evaluate(()=>[...document.querySelectorAll('[data-i18n]')].filter(e=>/[ก-๙]/.test(e.textContent)).map(e=>({id:e.id,key:e.dataset.i18n,text:e.textContent})));assert.deepEqual(thaiStatic,[],'English UI should contain no untranslated Thai strings');
 for(const [width,height] of [[1024,768],[1280,800],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});await settle();const geometry=await viewer.evaluate(()=>{const a=document.querySelector('.lab-sidebar').getBoundingClientRect(),p=document.querySelector('#plot').getBoundingClientRect();return {overflow:document.body.scrollWidth>innerWidth,overlap:p.right>a.left}});assert.equal(geometry.overflow,false);assert.equal(geometry.overlap,false);
  if(width===1280||width===1440){await page.evaluate(()=>document.querySelector('#viewer-host').scrollIntoView({block:'start'}));await settle();await page.screenshot({path:`test-results/objects-en-${width}.png`})}
 }
 // Selection handles are overlays; export still uses the stored annotations only.
 await page.setViewportSize({width:1440,height:900});await viewer.locator('#lab-button-export').click();await viewer.locator('#capture').click();await drag(160,50,650,340);await viewer.waitForFunction(()=>!document.querySelector('#downloadPNG').disabled);
 await viewer.locator('[data-language=th]').click();assert.equal(await viewer.locator('#downloadPNG').isDisabled(),false,'Language changes must keep a prepared export');
 const [download]=await Promise.all([page.waitForEvent('download'),viewer.locator('#downloadPNG').click()]);await download.saveAs('test-results/objects-export.png');assert((await fs.stat('test-results/objects-export.png')).size>1000);
 await viewer.locator('[data-language=en]').click();await viewer.locator('#mode3d').click();await viewer.locator('#lab-button-three').click();await viewer.locator('#top3d').click();await settle();
 const readPixels=()=>{const c=document.querySelector('#surface3d'),gl=c.getContext('webgl'),p=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p};
 await viewer.evaluate(fn=>{window.readGridPixels=eval('('+fn+')');window.gridBaseline=window.readGridPixels()},readPixels.toString());
 await viewer.locator('#lab-button-axis').click();await viewer.locator('#timeGrid').check();await settle();
 let changes=await viewer.evaluate(()=>{const p=readGridPixels();let n=0;for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-gridBaseline[i])+Math.abs(p[i+1]-gridBaseline[i+1])+Math.abs(p[i+2]-gridBaseline[i+2])>30)n++;return n});assert(changes>100,'Time grid should be visible through the top-down surface');
 await viewer.locator('#timeGrid').uncheck();await viewer.locator('#noteGrid').check();await settle();
 changes=await viewer.evaluate(()=>{const p=readGridPixels();let n=0;for(let i=0;i<p.length;i+=4)if(Math.abs(p[i]-gridBaseline[i])+Math.abs(p[i+1]-gridBaseline[i+1])+Math.abs(p[i+2]-gridBaseline[i+2])>30)n++;return n});assert(changes>100,'Note grid should be visible through the top-down surface');
 assert.equal(await viewer.locator('#surface3d').evaluate(c=>{const gl=c.getContext('webgl');return gl.isEnabled(gl.DEPTH_TEST)}),true,'Surface depth must be restored after grid rendering');
 await viewer.locator('#timeGrid').check();await viewer.locator('#lab-button-three').click();await viewer.locator('#reset3d').click();await settle();await page.evaluate(()=>document.querySelector('#viewer-host').scrollIntoView({block:'start'}));await page.screenshot({path:'test-results/grid3d-overlay-en.png'});
 assert.match(await viewer.locator('#status3d').textContent(),/Mesh/);await viewer.locator('#mode2d').click();assert.deepEqual(await saved(),beforeLanguage);
 // Both language choice and objects survive reopening the same audio.
 await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'en');await page.locator('#file-input').setInputFiles({name:'Object study.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>document.querySelector('#percent').textContent==='100%',{timeout:60000});viewer=page.frames().find(f=>f.url().includes('/viewer.html'));assert.deepEqual(await saved(),beforeLanguage);
 await page.locator('#change-file').click();await page.locator('#file-input').setInputFiles({name:'bad.wav',mimeType:'audio/wav',buffer:Buffer.from('invalid')});await page.locator('#error').waitFor({state:'visible'});assert.match(await page.locator('#error').textContent(),/decode/);await page.locator('[data-language=th]').click();assert.match(await page.locator('#error').textContent(),/อ่านไฟล์เสียงไม่ได้/);
 assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
 console.log('PASS: move/delete/copy/paste objects, keyboard shortcuts and field isolation, object property editing, presets, undo/redo, EN/TH live synchronization and persistence, 4 desktop widths, export preservation, visible 3D time/note grid pixels, reload and bilingual errors');
}finally{await browser.close()}
