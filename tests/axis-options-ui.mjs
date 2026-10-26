import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const rate=44100,seconds=6,bin=428,frequency=440*2**((15.5+(bin+.5)/8-69)/12),wav=Buffer.alloc(44+rate*seconds*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
for(let i=0;i<rate*seconds;i++)wav.writeInt16LE(Math.round(32767*[.5,.1,.01][Math.floor(i/rate/2)]*Math.sin(2*Math.PI*frequency*i/rate)),44+i*2);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8955/');await page.locator('[data-language=en]').click();await page.locator('#file-input').setInputFiles({name:'Calibrated levels.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>document.querySelector('#percent').textContent==='100%',{timeout:60000});const v=page.frames().find(f=>f.url().includes('/viewer.html'));
 const settle=()=>v.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));

 await v.locator('#lab-button-axis').click();assert.equal(await v.locator('#axis option').count(),4);
 assert.match(await v.locator('[data-i18n=levelCompare]').textContent(),/CQT.*dBFS/s);

 for(const mode of ['2d','3d']){
  await v.locator('#mode'+mode).click();await v.locator('#lab-button-axis').click();
  for(const axis of ['note','hz','note-only','hz-only']){
   await v.locator('#axis').selectOption(axis);await settle();assert.equal(await v.locator('#pianoFeedback').isVisible(),!axis.endsWith('-only'));
   if(mode==='2d'){const colors=await v.locator('#plot').evaluate(c=>{const g=c.getContext('2d'),set=new Set();for(let y=40;y<c.height-60;y++)set.add(Array.from(g.getImageData(105,y,1,1).data).join(','));return set.size});assert(axis.endsWith('-only')?colors===1:colors>1,'keyboard pixels '+axis)}
  }
  await v.locator('#lab-button-export').click();assert.equal(await v.locator('#png3d').isVisible(),mode==='3d');assert.equal(await v.locator('#capture').isVisible(),mode==='2d');
  if(mode==='3d'){assert.equal(await v.locator('#lab-panel-three #png3d').count(),0);const [download]=await Promise.all([page.waitForEvent('download'),v.locator('#png3d').click()]);assert.equal(download.suggestedFilename(),'spectrogram-3d.png')}
 }
 for(const lang of ['th','en']){await v.locator('[data-language='+lang+']').click();await v.locator('#lab-button-colors').click();assert(!/Aurora/.test(await v.locator('[data-i18n=peak]').textContent()));assert(!/linear/.test(await v.locator('[data-i18n=gain]').textContent()));await v.locator('#lab-button-axis').click();assert.match(await v.locator('[data-i18n=levelCompare]').textContent(),/CQT.*dBFS/s)}
 await page.screenshot({path:'test-results/axes-only-3d.png'});assert.deepEqual(errors,[]);console.log('PASS: four axis choices, keyboard visibility, bilingual labels/comparison, separate 3D PNG export and mode switching');
}finally{await browser.close()}
