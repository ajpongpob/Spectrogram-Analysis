'use strict';
import {referenceRGB,legacyIntensity} from './reference-color.mjs';
const $=id=>document.getElementById(id),audio=$('audio'),canvas=$('plot'),ctx=canvas.getContext('2d');
const payload=$('payload'),meta=payload?JSON.parse(payload.textContent):{rows:0,duration:0};payload?.remove();
const LEFT=108,TOP=12,BOTTOM=30,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const hz=m=>440*2**((m-69)/12),note=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1);
const binPitch=b=>15.5+(b+.5)/8,pitchBin=m=>(m-15.5)*8-.5;
let samples,peaks,rawEncoding=false,start=10,span=10,lo=15.5,hi=135.5,W=1000,H=700,dirty=true,lastPlay=-1,drag=null,modeName='pan';
const cached=document.createElement('canvas');
const view=()=>({start,span,lo,hi});
const yAt=(m,v,h)=>TOP+(v.hi-m)/(v.hi-v.lo)*(h-TOP-BOTTOM);
const pAt=(y,v,h)=>v.hi-(y-TOP)/(h-TOP-BOTTOM)*(v.hi-v.lo);
const xAt=(t,v,w)=>LEFT+(t-v.start)/v.span*(w-LEFT);
const tAt=(x,v,w)=>v.start+(x-LEFT)/(w-LEFT)*v.span;
const yForPitch=m=>yAt(m,view(),H),pitchForY=y=>pAt(y,view(),H);
const palettes={magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],inferno:[[0,0,4],[87,16,110],[188,55,84],[249,142,9],[252,255,164]],viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],gray:[[0,0,0],[64,64,64],[128,128,128],[192,192,192],[255,255,255]]};
const gainLabel=document.createElement('label');gainLabel.innerHTML='ความสว่าง (linear) <input id="gain" type="range" min="0" max="3" step="0.01" value="1" aria-label="ความสว่างแบบเชิงเส้น"><output id="gainValue" for="gain">1.00×</output>';document.querySelector('.tools').append(gainLabel);
const gainNumber=document.createElement('input');gainNumber.type='number';gainNumber.id='gainNumber';gainNumber.min='0';gainNumber.max='3';gainNumber.step='0.01';gainNumber.value='1';gainNumber.setAttribute('aria-label','ระบุความสว่าง');gainNumber.style.width='75px';gainLabel.after(gainNumber);
function style(){return {axis:$('axis').value,clock:$('timeFormat').value==='clock',palette:$('palette').value,gain:+$('gain').value,peak:$('peakEnhance').checked,noteGrid:$('noteGrid').checked,timeGrid:$('timeGrid').checked}}
function colorLut(s){if(s.palette==='reference')return Array.from({length:4096},(_,i)=>referenceRGB(i/4095));const stops=palettes[s.palette];return Array.from({length:4096},(_,i)=>{const v=Math.min(1,i/4095*s.gain)*4,j=Math.min(3,Math.floor(v)),f=v-j;return stops[j].map((a,c)=>Math.round(a*(1-f)+stops[j+1][c]*f))})}
function formatTime(sec,digits=2,clock=style().clock){const factor=10**digits,total=Math.round(Math.max(0,sec)*factor);if(!clock)return (total/factor).toFixed(digits)+'s';const mins=Math.floor(total/(60*factor)),rest=(total-mins*60*factor)/factor;return mins+':'+rest.toFixed(digits).padStart(digits?digits+3:2,'0')}
function ticks(v,w){const target=v.span/Math.max(2,Math.floor((w-LEFT)/100)),p=10**Math.floor(Math.log10(target)),step=[1,2,5,10].map(n=>n*p).find(n=>n>=target),a=[];for(let i=Math.ceil(v.start/step);i*step<=v.start+v.span;i++)a.push(i*step);return {values:a,digits:Math.max(0,-Math.floor(Math.log10(step)))}}
function bytes(s){const raw=atob(s),b=new Uint8Array(raw.length);for(let i=0;i<b.length;i++)b[i]=raw.charCodeAt(i);return b}
function intensity(t,b,data=samples){const t0=Math.floor(t),t1=Math.min(meta.rows-1,t0+1),b0=Math.floor(b),b1=Math.min(959,b0+1),x=t-t0,y=b-b0;return (data[t0*960+b0]*(1-y)+data[t0*960+b1]*y)*(1-x)+(data[t1*960+b0]*(1-y)+data[t1*960+b1]*y)*x}

let annotations=[],undoStack=[],redoStack=[];
let storageKey='musical-detail:rosanna:960:19790:annotations:v1';
function loadInk(){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))annotations=saved.filter(a=>['rect','line','highlight'].includes(a.type)&&/^#[0-9a-f]{6}$/i.test(a.color)&&Number.isFinite(a.width)&&a.width>0&&Array.isArray(a.points)&&a.points.length>=2&&a.points.every(p=>Number.isFinite(p.t)&&Number.isFinite(p.m)))}catch{}annotationControls()}
function annotationControls(){for(const [id,enabled] of [['undo',undoStack.length],['redo',redoStack.length],['clearInk',annotations.length]])$(id).disabled=!enabled}
function saveInk(){try{localStorage.setItem(storageKey,JSON.stringify(annotations));$('annotationInfo').textContent=`บันทึกในเบราว์เซอร์นี้แล้ว · ${annotations.length} รายการ`}catch{$('annotationInfo').textContent='เบราว์เซอร์บันทึกสิ่งที่วาดไม่ได้ กรุณาคัดลอกหรือดาวน์โหลด PNG ก่อนปิด'}annotationControls()}
function editInk(next){undoStack.push(annotations);redoStack=[];annotations=next;saveInk();changed()}
$('undo').onclick=()=>{if(undoStack.length){redoStack.push(annotations);annotations=undoStack.pop();saveInk();changed()}};
$('redo').onclick=()=>{if(redoStack.length){undoStack.push(annotations);annotations=redoStack.pop();saveInk();changed()}};
$('clearInk').onclick=()=>editInk([]);annotationControls();
function drawInk(g,v,w,h,list){g.save();g.beginPath();g.rect(LEFT,TOP,w-LEFT,h-TOP-BOTTOM);g.clip();for(const a of list){g.save();g.strokeStyle=a.color;g.lineWidth=a.type==='highlight'?a.width*6:a.width;g.lineCap='round';g.lineJoin='round';g.globalAlpha=a.type==='highlight'?.3:1;const p=a.points.map(p=>({x:xAt(p.t,v,w),y:yAt(p.m,v,h)}));g.beginPath();if(a.type==='rect')g.rect(p[0].x,p[0].y,p[1].x-p[0].x,p[1].y-p[0].y);else{g.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)g.lineTo(p[i].x,p[i].y)}g.stroke();g.restore()}g.restore()}

// Render from analysis values at the requested resolution; PNG export uses
// the same mapping as the screen and does not enlarge a screenshot bitmap.
function drawScene(target,v,s,list,w,h,scale=1,crop=null){
 const area=crop||{x:0,y:0,w,h};target.width=Math.max(1,Math.round(area.w*scale));target.height=Math.max(1,Math.round(area.h*scale));
 const g=target.getContext('2d'),lut=colorLut(s);g.fillStyle='#0c0b12';g.fillRect(0,0,target.width,target.height);
 const ax=Math.max(LEFT,area.x),ay=Math.max(TOP,area.y),bx=Math.min(w,area.x+area.w),by=Math.min(h-BOTTOM,area.y+area.h);
 const rw=Math.max(0,Math.round((bx-ax)*scale)),rh=Math.max(0,Math.round((by-ay)*scale));
 if(rw&&rh){const im=g.createImageData(rw,rh),bins=Float64Array.from({length:rh},(_,y)=>clamp(pitchBin(pAt(ay+(y+.5)/scale,v,h)),0,959));
  for(let x=0;x<rw;x++){const sec=tAt(ax+(x+.5)/scale,v,w),t=clamp(sec*60,0,meta.rows-1);for(let y=0;y<rh;y++){const valid=sec>=0&&sec<=meta.duration,raw=valid?intensity(t,bins[y]):0,ref=s.palette==='reference',val=ref?raw*s.gain:(rawEncoding?legacyIntensity(raw,bins[y]):raw),col=lut[clamp(Math.round(val*4095),0,4095)],p=(y*rw+x)*4,a=valid&&ref&&s.peak&&peaks?intensity(t,bins[y],peaks)/255:0;im.data[p]=col[0]*(1-.6*a);im.data[p+1]=col[1]*(1-.8*a);im.data[p+2]=col[2]*(1-.2*a);im.data[p+3]=255}}
  g.putImageData(im,Math.round((ax-area.x)*scale),Math.round((ay-area.y)*scale));
 }
 g.scale(scale,scale);g.translate(-area.x,-area.y);
 g.save();g.beginPath();g.rect(0,TOP,w,h-TOP-BOTTOM);g.clip();let last=-100;const px=(h-TOP-BOTTOM)/(v.hi-v.lo);g.font='11px system-ui';g.textBaseline='middle';
 for(let m=Math.floor(v.hi+.5);m>=Math.ceil(v.lo-.5);m--){const y=yAt(m,v,h),a=yAt(m+.5,v,h),b=yAt(m-.5,v,h),black=[1,3,6,8,10].includes((m%12+12)%12);g.fillStyle=black?'#24202f':'#d5d0df';g.fillRect(77,a,30,b-a);g.strokeStyle='#61566f';g.lineWidth=1;g.strokeRect(77,a,30,b-a);
  if(s.noteGrid){g.strokeStyle=m%12===0?'#ffffff55':'#ffffff29';g.beginPath();g.moveTo(LEFT,y);g.lineTo(w,y);g.stroke()}
  if(y>=TOP&&y<=h-BOTTOM&&y-last>=12&&(px>=12||!black)){g.fillStyle='#ddd4e9';g.textAlign='right';g.fillText(s.axis==='note'?note(m):hz(m).toFixed(hz(m)<100?1:0),70,y);last=y}
 }
 g.restore();const tick=ticks(v,w);g.font='11px system-ui';g.textAlign='center';g.textBaseline='top';
 for(const sec of tick.values){const x=xAt(sec,v,w);if(s.timeGrid){g.strokeStyle='#ffffff35';g.beginPath();g.moveTo(x,TOP);g.lineTo(x,h-BOTTOM);g.stroke()}if(x<=w-25){g.fillStyle='#bbb0ca';g.fillText(formatTime(sec,tick.digits,s.clock),x,h-BOTTOM+8)}}
 drawInk(g,v,w,h,list);g.setTransform(1,0,0,1,0,0);return target;
}
function render(){if(!samples)return;W=canvas.width;H=canvas.height;drawScene(cached,view(),style(),annotations,W,H);dirty=false;overlay()}
function overlay(){if(!cached.width||!samples)return;ctx.clearRect(0,0,W,H);ctx.drawImage(cached,0,0);const x=xAt(audio.currentTime,view(),W);if(x>=LEFT&&x<=W){ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,TOP);ctx.lineTo(x,H-BOTTOM);ctx.stroke()}
 if(drag?.moved){if(['rect','line','highlight'].includes(drag.mode))drawInk(ctx,drag.view,W,H,[draft(drag)]);else if(['zoom','capture'].includes(drag.mode))selectionBox(drag.x,drag.y,drag.endX-drag.x,drag.endY-drag.y)}
 if(captureState)selectionBox(captureState.area.x,captureState.area.y,captureState.area.w,captureState.area.h);
}
function selectionBox(x,y,w,h){ctx.save();ctx.strokeStyle='#d4b8ff';ctx.lineWidth=1;ctx.setLineDash([6,4]);ctx.fillStyle='#b58cff19';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.restore()}
function resize(){canvas.width=Math.max(320,Math.floor(canvas.clientWidth));canvas.height=Math.max(400,Math.floor(canvas.clientHeight));W=canvas.width;H=canvas.height;changed()}new ResizeObserver(resize).observe(canvas);
function changed(){dirty=true;invalidateCapture()}
function syncZoom(){for(const [id,value,text] of [['span',String(span),span.toFixed(2)],['range',`${lo},${hi}`,`${note(Math.round(lo))}–${note(Math.round(hi))} (ซูม)`]]){const select=$(id);select.querySelector('option[data-custom]')?.remove();if(![...select.options].some(o=>o.value===value)){const o=new Option(text,value);o.dataset.custom='1';select.add(o)}select.value=value}
 $('zoomInfo').textContent=`${formatTime(start)}–${formatTime(start+span)} · ${(hi-lo).toFixed(1)} ครึ่งเสียง`;changed()}
function setTime(s,length){span=clamp(length,.25,meta.duration);start=clamp(s,0,Math.max(0,meta.duration-span))}
function setPitch(lower,width){const range=clamp(width,3,120);lo=clamp(lower,15.5,135.5-range);hi=lo+range}
function position(t){setTime(t-span*.25,span);syncZoom()}
function manual(){$('follow').checked=false}
function zoomTime(factor,anchor=clamp(audio.currentTime,start,start+span)){manual();const ratio=(anchor-start)/span,length=clamp(span*factor,.25,meta.duration);setTime(anchor-ratio*length,length);syncZoom()}
function zoomPitch(factor,anchor=(lo+hi)/2){manual();const ratio=(anchor-lo)/(hi-lo),range=clamp((hi-lo)*factor,3,120);setPitch(anchor-ratio*range,range);syncZoom()}
for(const [id,fn] of Object.entries({timeIn:()=>zoomTime(.5),timeOut:()=>zoomTime(2),pitchIn:()=>zoomPitch(.5),pitchOut:()=>zoomPitch(2),fit:()=>{manual();setTime(0,meta.duration);setPitch(15.5,120);syncZoom()},reset:()=>{setPitch(15.5,120);span=10;position(audio.currentTime)}}))$(id).onclick=fn;
for(const id of ['axis','palette','peakEnhance','noteGrid','timeGrid'])$(id).onchange=changed;
function updateGain(value,syncNumber=true){if(!Number.isFinite(value))return;const n=Math.round(clamp(value,0,3)*100)/100;$('gain').value=n;if(syncNumber)gainNumber.value=n.toFixed(2);$('gainValue').value=n.toFixed(2)+'×';changed()}
$('gain').oninput=()=>updateGain(+$('gain').value);gainNumber.oninput=()=>{if(gainNumber.value!=='')updateGain(gainNumber.valueAsNumber,false)};gainNumber.onchange=()=>updateGain(gainNumber.value===''?1:gainNumber.valueAsNumber);
$('timeFormat').onchange=syncZoom;
$('span').onchange=()=>{const s=+$('span').value;setTime(audio.currentTime-s*.25,s);syncZoom()};
$('range').onchange=()=>{const [a,b]=$('range').value.split(',').map(Number);setPitch(a,b-a);syncZoom()};
$('seek').max=meta.duration;$('seek').oninput=()=>{audio.currentTime=+$('seek').value;position(audio.currentTime)};
function setMode(name){modeName=name;for(const [id,m] of [['boxZoom','zoom'],['capture','capture']]){$(id).setAttribute('aria-pressed',String(name===m));$(id).style.background=name===m?'#6b3da0':''}if(['pan','rect','line','highlight'].includes(name))$('tool').value=name;canvas.style.cursor=name==='pan'?'grab':'crosshair';drag=null;overlay()}
$('tool').onchange=()=>setMode($('tool').value);$('boxZoom').onclick=()=>setMode(modeName==='zoom'?'pan':'zoom');$('capture').onclick=()=>{manual();audio.pause();setMode(modeName==='capture'?'pan':'capture')};
function point(e,full=false){const r=canvas.getBoundingClientRect();return {x:clamp((e.clientX-r.left)*W/r.width,full?0:LEFT,W),y:clamp((e.clientY-r.top)*H/r.height,full?0:TOP,full?H:H-BOTTOM)}}
function dataPoint(p,v){return {t:tAt(p.x,v,W),m:pAt(p.y,v,H)}}
function draft(d){const pts=d.mode==='highlight'?d.points:[dataPoint({x:d.x,y:d.y},d.view),dataPoint({x:d.endX,y:d.endY},d.view)];return {type:d.mode,color:d.color,width:d.width,points:pts}}
canvas.onpointerdown=e=>{if(!samples||e.button!==0||drag)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(modeName!=='capture'&&(x<LEFT||y<TOP||y>H-BOTTOM))return;const p=point(e,modeName==='capture');if(modeName!=='pan'){manual();audio.pause()}invalidateCapture();drag={...p,endX:p.x,endY:p.y,view:view(),mode:modeName,moved:false,color:$('ink').value,width:+$('penWidth').value,points:[dataPoint(p,view())]};canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{const p=point(e,drag?.mode==='capture');if(!drag){if(p.x>LEFT)$('readout').textContent=`เวลา ${formatTime(tAt(p.x,view(),W))} · ${hz(pAt(p.y,view(),H)).toFixed(2)} Hz · โน้ตใกล้ที่สุด ${note(Math.round(pAt(p.y,view(),H)))}`;return}
 const d=drag,dx=p.x-d.x,dy=p.y-d.y;d.endX=p.x;d.endY=p.y;if(Math.hypot(dx,dy)>3)d.moved=true;if(!d.moved)return;manual();if(d.mode==='pan'){setTime(d.view.start-dx/(W-LEFT)*d.view.span,d.view.span);setPitch(d.view.lo+dy/(H-TOP-BOTTOM)*(d.view.hi-d.view.lo),d.view.hi-d.view.lo);syncZoom()}else{if(d.mode==='highlight')d.points.push(dataPoint(p,d.view));if(dirty)render();else overlay()}};
canvas.onpointerup=e=>{if(!drag)return;const d=drag;drag=null;canvas.releasePointerCapture(e.pointerId);const area={x:Math.min(d.x,d.endX),y:Math.min(d.y,d.endY),w:Math.abs(d.endX-d.x),h:Math.abs(d.endY-d.y)};
 if(d.moved&&d.mode==='capture'&&area.w>=8&&area.h>=8){setMode('pan');prepareCapture(area);return}
 if(d.moved&&d.mode==='zoom'&&area.w>8&&area.h>8){const lower=pAt(area.y+area.h,d.view,H),upper=pAt(area.y,d.view,H);setTime(tAt(area.x,d.view,W),area.w/(W-LEFT)*d.view.span);setPitch(lower,upper-lower);setMode('pan');syncZoom()}
 else if(d.moved&&['rect','line','highlight'].includes(d.mode)){editInk([...annotations,draft(d)])}
 else if(!d.moved&&d.mode==='pan'){audio.currentTime=clamp(tAt(d.x,view(),W),0,meta.duration)}
 dirty=true;
};
canvas.onpointercancel=()=>{drag=null;dirty=true};document.addEventListener('keydown',e=>{if(e.key==='Escape'){drag=null;setMode('pan');invalidateCapture();dirty=true}});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!samples||drag)return;const p=point(e),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?H:1),factor=Math.exp(clamp(delta,-300,300)*.002);if(e.ctrlKey)zoomPitch(factor,pAt(p.y,view(),H));else zoomTime(factor,tAt(p.x,view(),W))},{passive:false});

let captureState=null,captureToken=0;
function invalidateCapture(){if(!captureState)return;captureState=null;captureToken++;$('copyPNG').disabled=true;$('downloadPNG').disabled=true;$('captureInfo').textContent='ภาพเปลี่ยนแล้ว กรุณาเลือกกรอบใหม่'}
async function prepareCapture(area){const token=++captureToken,snapshot={area,view:view(),style:style(),ink:structuredClone(annotations),w:W,h:H};captureState=snapshot;$('copyPNG').disabled=true;$('downloadPNG').disabled=true;$('captureInfo').textContent='กำลังสร้าง PNG ความละเอียดสูง…';overlay();await new Promise(r=>setTimeout(r,20));if(token!==captureToken)return;
 try{const requested=+$('exportScale').value,scale=Math.min(requested,8192/area.w,8192/area.h,Math.sqrt(16000000/(area.w*area.h)));const out=drawScene(document.createElement('canvas'),snapshot.view,snapshot.style,snapshot.ink,W,H,scale,area);const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('สร้าง PNG ไม่สำเร็จ')),'image/png'));if(token!==captureToken)return;snapshot.blob=blob;snapshot.width=out.width;snapshot.height=out.height;$('copyPNG').disabled=false;$('downloadPNG').disabled=false;$('captureInfo').textContent=`PNG ${out.width} × ${out.height} px · พร้อมคัดลอก / ดาวน์โหลด`;out.width=out.height=1}catch(e){$('captureInfo').textContent=e.message}
}
$('exportScale').onchange=()=>{if(captureState)prepareCapture(captureState.area)};
$('copyPNG').onclick=async()=>{const selected=captureState;if(!selected?.blob)return;try{if(!navigator.clipboard?.write||!window.ClipboardItem)throw Error('เบราว์เซอร์นี้ไม่รองรับการคัดลอกภาพ');await navigator.clipboard.write([new ClipboardItem({'image/png':selected.blob})]);$('captureInfo').textContent=`คัดลอก PNG ${selected.width} × ${selected.height} px แล้ว — วางด้วย Ctrl/⌘ + V`}catch(e){$('captureInfo').textContent='คัดลอกไม่ได้ กรุณาอนุญาตคลิปบอร์ด หรือกดดาวน์โหลด PNG'}};
$('downloadPNG').onclick=()=>{if(!captureState?.blob)return;const url=URL.createObjectURL(captureState.blob),a=document.createElement('a');a.href=url;a.download='Rosanna-spectrogram-selection.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
function isPlaybackSpace(e){if((e.code!=='Space'&&e.key!==' ')||e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return false;return !e.composedPath().some(el=>el instanceof HTMLElement&&(el.isContentEditable||el.matches('textarea,select,input:not([type=range]):not([type=checkbox]):not([type=button])')))}
document.addEventListener('keydown',e=>{if(!isPlaybackSpace(e))return;e.preventDefault();e.stopPropagation();if(e.repeat||!samples||audio.readyState<1)return;if(audio.paused)audio.play().catch(()=>{$('status').textContent='กรุณากดปุ่มเล่นเสียงอีกครั้ง'});else audio.pause()},{capture:true});
document.addEventListener('keyup',e=>{if(isPlaybackSpace(e)){e.preventDefault();e.stopPropagation()}},{capture:true});
audio.addEventListener('seeked',()=>{$('seek').value=audio.currentTime;if($('follow').checked&&(audio.currentTime<start||audio.currentTime>start+span))position(audio.currentTime);overlay()});
audio.addEventListener('pause',()=>{$('seek').value=audio.currentTime;overlay()});$('follow').onchange=()=>{if($('follow').checked)position(audio.currentTime)};
async function init(){try{const packed=bytes(meta.data);meta.data='';const buf=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();samples=new Float32Array(buf);if(samples.length!==meta.rows*960)throw Error('จำนวนข้อมูลไม่ตรง');audio.src=URL.createObjectURL(new Blob([bytes(meta.audio)],{type:'audio/mpeg'}));meta.audio='';audio.addEventListener('loadedmetadata',()=>{audio.currentTime=15},{once:true});$('status').textContent='พร้อมใช้งาน · ออฟไลน์';resize();requestAnimationFrame(tick)}catch(e){$('status').textContent='เปิดไม่ได้: '+e.message}}
function tick(){let moved=false;if(!audio.paused&&Math.abs(audio.currentTime-lastPlay)>.04){if($('follow').checked&&(audio.currentTime>start+span*.85||audio.currentTime<start))position(audio.currentTime);$('seek').value=audio.currentTime;lastPlay=audio.currentTime;moved=true}if(dirty)render();else if(moved)overlay();requestAnimationFrame(tick)}
window.viewerTest={binPitch,pitchBin,hz,note,yForPitch,pitchForY,formatTime,get state(){return {...view(),rows:meta.rows,ready:!!samples,annotations:annotations.length}},sample:(frame,bin)=>samples[frame*960+bin]};
syncZoom();if(payload){loadInk();init()}else{
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='analysis-ready'||samples)return;try{const d=e.data;meta.rows=d.rows;meta.duration=d.duration;samples=new Float32Array(d.values);rawEncoding=d.encoding==='raw-cqt-v1';peaks=d.peaks?new Uint8Array(d.peaks):null;if(peaks&&peaks.length!==samples.length)throw Error('ข้อมูลยอดเสียงไม่ครบ');if(samples.length!==meta.rows*960)throw Error('ข้อมูลวิเคราะห์ไม่ครบ');storageKey='musical-detail:'+d.key+':annotations:v1';loadInk();audio.src=URL.createObjectURL(d.audio);$('seek').max=meta.duration;start=0;span=Math.min(10,meta.duration);document.querySelector('h1').textContent=d.name;document.title=d.name+' · Musical Detail';$('status').textContent='พร้อมใช้งาน';syncZoom();resize();requestAnimationFrame(tick);parent.postMessage({type:'viewer-ready'},location.origin)}catch(error){parent.postMessage({type:'viewer-error',message:error.message},location.origin)}});
 new ResizeObserver(()=>parent.postMessage({type:'viewer-height',height:document.body.scrollHeight},location.origin)).observe(document.body);
 parent.postMessage({type:'viewer-listening'},location.origin);
}

