import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// A generated tone keeps the interaction test independent of private audio files.
const rate=44100,seconds=4,wav=Buffer.alloc(44+rate*seconds*2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
for(let i=0;i<rate*seconds;i++)wav.writeInt16LE(Math.round(Math.sin(2*Math.PI*440*i/rate)*12000),44+i*2);
const base=process.env.TEST_URL||'http://127.0.0.1:8954/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
await fs.mkdir('test-results',{recursive:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function load(){await page.goto(base);await page.locator('#file-input').setInputFiles({name:'Annotation test.wav',mimeType:'audio/wav',buffer:wav});await page.waitForFunction(()=>document.querySelector('#percent').textContent==='100%',{timeout:60000});return page.frames().find(f=>f.url().includes('/viewer.html'))}
 let viewer=await load();
 const count=()=>viewer.evaluate(()=>viewerTest.state.annotations);
 const saved=()=>viewer.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.endsWith(':annotations:v1')))||'[]'));
 await viewer.locator('#lab-button-colors').focus();await viewer.locator('#lab-button-colors').press('Space');await viewer.locator('#lab-panel-colors').waitFor({state:'visible'});
 assert.match(await viewer.locator('#palette option[value="reference"]').textContent(),/^Aurora/);
 assert.match(await viewer.locator('#palette option[value="gray"]').textContent(),/^Graphite/);
 await viewer.locator('#palette').selectOption('gray');
 await viewer.locator('#lab-button-draw').click();
 assert.equal(await viewer.locator('.lab-panel:not([hidden])').count(),1);
 await viewer.locator('#tool').selectOption('text');
 await viewer.locator('#annotationText').fill('ท่อน A\nMelody');
 await viewer.locator('#annotationText').press('End');await viewer.locator('#annotationText').press('Space');await viewer.locator('#annotationText').press('1');
 assert.equal(await viewer.locator('#audio').evaluate(a=>a.paused),true,'Typing spaces must not start playback');
 await viewer.locator('#textSize').fill('22');await viewer.locator('#textSize').press('ArrowUp');await viewer.locator('#textSize').press('Tab');
 assert.equal(await viewer.locator('#textSize').inputValue(),'23','Accordion arrow handling must not intercept number fields');
 await viewer.locator('#ink').fill('#e60000');
 await viewer.locator('#plot').click({position:{x:220,y:90}});
 assert.equal(await count(),1);
 assert.equal(await viewer.locator('#lab-panel-draw').isVisible(),true,'Drawing must leave the section expanded');
 await viewer.locator('#lab-button-draw').click();assert.equal(await viewer.locator('#lab-panel-draw').isVisible(),true,'Active heading stays expanded');
 await viewer.locator('#annotationText').press('Escape');assert.equal(await viewer.locator('#lab-panel-draw').isVisible(),true);
 const text=(await saved())[0];assert.equal(text.text,'ท่อน A\nMelody 1');assert.equal(text.fontSize,23);
 await viewer.locator('#undo').click();assert.equal(await count(),0);await viewer.locator('#redo').click();assert.equal(await count(),1);
 await viewer.waitForFunction(()=>{const c=document.querySelector('#plot'),p=c.getContext('2d').getImageData(215,85,220,90).data;let red=0;for(let i=0;i<p.length;i+=4)if(p[i]>130&&p[i+1]<80&&p[i+2]<80)red++;return red>100});
 await viewer.locator('#tool').selectOption('line');await viewer.locator('#penWidthNumber').fill('1.25');await viewer.locator('#penWidthNumber').press('Tab');assert.equal(await viewer.locator('#penWidth').inputValue(),'1.25');
 let plot=await viewer.locator('#plot').boundingBox();await page.mouse.move(plot.x+210,plot.y+240);await page.mouse.down();await page.mouse.move(plot.x+500,plot.y+240,{steps:8});await page.mouse.up();
 assert.equal(await count(),2);assert.equal((await saved())[1].width,1.25);
 await viewer.locator('#timeIn').click();assert.deepEqual((await saved())[0].points,text.points,'Zoom must retain the time and pitch anchor');
 await viewer.locator('#lab-button-zoom').click();await viewer.locator('#fit').click();
 await viewer.locator('#lab-button-export').click();await viewer.locator('#exportScale').selectOption('2');await viewer.locator('#capture').click();
 plot=await viewer.locator('#plot').boundingBox();await page.mouse.move(plot.x+180,plot.y+60);await page.mouse.down();await page.mouse.move(plot.x+620,plot.y+320,{steps:8});await page.mouse.up();
 assert.equal(await viewer.locator('#lab-panel-export').isVisible(),true,'Capture must leave export actions visible');await viewer.waitForFunction(()=>!document.querySelector('#downloadPNG').disabled);
 const [download]=await Promise.all([page.waitForEvent('download'),viewer.locator('#downloadPNG').click()]);await download.saveAs('test-results/annotations-export.png');
 const png=await fs.readFile('test-results/annotations-export.png');const scale=await viewer.locator('#plot').evaluate(c=>({x:c.width/c.getBoundingClientRect().width,y:c.height/c.getBoundingClientRect().height}));assert.equal(png.readUInt32BE(16),Math.round(440*scale.x*2));assert.equal(png.readUInt32BE(20),Math.round(260*scale.y*2));
 const redPixels=await page.evaluate(async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);const p=g.getImageData(0,0,c.width,250).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]>130&&p[i+1]<80&&p[i+2]<80)n++;return n},png.toString('base64'));assert(redPixels>200,'Export must contain the red text, above the line');
 viewer=await load();assert.equal(await count(),2,'Reloading the same audio restores text and strokes');assert.deepEqual((await saved())[0],text);
 await viewer.locator('#lab-button-draw').click();await viewer.locator('#tool').selectOption('text');await viewer.locator('#annotationText').fill('ท่อน A\nMelody 1');
 for(const [width,height] of [[1280,800],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});await viewer.waitForFunction(()=>document.querySelector('#plot').width===Math.floor(document.querySelector('#plot').clientWidth));
  const layout=await viewer.evaluate(()=>{const p=document.querySelector('#plot').getBoundingClientRect(),a=document.querySelector('.lab-sidebar').getBoundingClientRect(),b=document.querySelector('#lab-button-draw').getBoundingClientRect(),r=document.querySelector('#lab-panel-draw').getBoundingClientRect();return {plotRight:p.right,asideLeft:a.left,panelTop:r.top,headingBottom:b.bottom,overflow:document.body.scrollWidth>innerWidth,position:getComputedStyle(document.querySelector('#lab-panel-draw')).position}});
  assert(layout.plotRight<layout.asideLeft);assert.equal(layout.panelTop,layout.headingBottom);assert.equal(layout.position,'static');assert.equal(layout.overflow,false);
  await page.evaluate(()=>document.querySelector('#viewer-host').scrollIntoView({block:'start'}));await page.screenshot({path:`test-results/annotation-desktop-${width}.png`});
 }
 await viewer.locator('#mode3d').click();await viewer.locator('#lab-panel-three').waitFor({state:'visible'});await viewer.locator('#pitch3d').fill('35');await viewer.locator('#pitch3d').dispatchEvent('input');assert.equal(await viewer.locator('#pitchAngleOut').textContent(),'35°');
 await viewer.locator('#mode2d').click();await viewer.locator('#lab-panel-colors').waitFor({state:'visible'});assert.equal(await count(),2);
 assert.deepEqual(errors,[]);console.log('PASS: persistent accordion at three desktop sizes; fractional strokes; Thai/multiline text, keyboard input, undo/redo, time/pitch anchoring, reload persistence, PNG pixels and 2D/3D switching');
}finally{await browser.close()}
