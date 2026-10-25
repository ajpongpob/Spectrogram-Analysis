'use strict';
import {referenceRGB,legacyIntensity} from './reference-color.mjs';
import {createSurface} from './surface-3d.mjs?v=lab-annotations-2';
const $=id=>document.getElementById(id),audio=$('audio'),canvas=$('plot'),ctx=canvas.getContext('2d');
const payload=$('payload'),meta=payload?JSON.parse(payload.textContent):{rows:0,duration:0};payload?.remove();
const LEFT=108,TOP=12,BOTTOM=30,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const hz=m=>440*2**((m-69)/12),note=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1);
const binPitch=b=>15.5+(b+.5)/8,pitchBin=m=>(m-15.5)*8-.5;
let sourceName='spectrogram',samples,peaks,rawEncoding=false,start=10,span=10,lo=15.5,hi=135.5,W=1000,H=700,dirty=true,lastPlay=-1,drag=null,modeName='pan';
const cached=document.createElement('canvas');
const view=()=>({start,span,lo,hi});
const yAt=(m,v,h)=>TOP+(v.hi-m)/(v.hi-v.lo)*(h-TOP-BOTTOM);
const pAt=(y,v,h)=>v.hi-(y-TOP)/(h-TOP-BOTTOM)*(v.hi-v.lo);
const xAt=(t,v,w)=>LEFT+(t-v.start)/v.span*(w-LEFT);
const tAt=(x,v,w)=>v.start+(x-LEFT)/(w-LEFT)*v.span;
const yForPitch=m=>yAt(m,view(),H),pitchForY=y=>pAt(y,view(),H);
const palettes={magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],inferno:[[0,0,4],[87,16,110],[188,55,84],[249,142,9],[252,255,164]],viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],gray:[[255,255,255],[192,192,192],[128,128,128],[64,64,64],[0,0,0]]};
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
function loadInk(){
 try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))annotations=saved.filter(a=>{
  if(!a||!['rect','line','highlight','text'].includes(a.type)||!/^#[0-9a-f]{6}$/i.test(a.color)||!Array.isArray(a.points)||!a.points.every(p=>p&&Number.isFinite(p.t)&&Number.isFinite(p.m)))return false;
  if(a.type==='text')return a.points.length===1&&typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=240&&Number.isFinite(a.fontSize)&&a.fontSize>=8&&a.fontSize<=96;
  return Number.isFinite(a.width)&&a.width>0&&a.points.length>=2;
 })}catch{}annotationControls();
}
function annotationControls(){for(const [id,enabled] of [['undo',undoStack.length],['redo',redoStack.length],['clearInk',annotations.length]])$(id).disabled=!enabled}
function saveInk(){try{localStorage.setItem(storageKey,JSON.stringify(annotations));$('annotationInfo').textContent=`บันทึกในเบราว์เซอร์นี้แล้ว · ${annotations.length} รายการ`}catch{$('annotationInfo').textContent='เบราว์เซอร์บันทึกสิ่งที่วาดไม่ได้ กรุณาคัดลอกหรือดาวน์โหลด PNG ก่อนปิด'}annotationControls()}
function editInk(next){undoStack.push(annotations);redoStack=[];annotations=next;saveInk();changed()}
$('undo').onclick=()=>{if(undoStack.length){redoStack.push(annotations);annotations=undoStack.pop();saveInk();changed()}};
$('redo').onclick=()=>{if(redoStack.length){undoStack.push(annotations);annotations=redoStack.pop();saveInk();changed()}};
$('clearInk').onclick=()=>editInk([]);annotationControls();
function drawInk(g,v,w,h,list){
 g.save();g.beginPath();g.rect(LEFT,TOP,w-LEFT,h-TOP-BOTTOM);g.clip();
 for(const a of list){
  g.save();const p=a.points.map(p=>({x:xAt(p.t,v,w),y:yAt(p.m,v,h)}));
  if(a.type==='text'){
   g.fillStyle=a.color;g.font=`${a.fontSize}px system-ui, sans-serif`;g.textAlign='left';g.textBaseline='top';
   a.text.split('\n').forEach((line,i)=>g.fillText(line,p[0].x,p[0].y+i*a.fontSize*1.45));
  }else{
   // Older saved highlights used a sixfold width multiplier.
   g.strokeStyle=a.color;g.lineWidth=a.type==='highlight'&&!a.strokePixels?a.width*6:a.width;
   g.lineCap='round';g.lineJoin='round';g.globalAlpha=a.type==='highlight'?.3:1;g.beginPath();
   if(a.type==='rect')g.rect(p[0].x,p[0].y,p[1].x-p[0].x,p[1].y-p[0].y);
   else{g.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)g.lineTo(p[i].x,p[i].y)}g.stroke();
  }
  g.restore();
 }
 g.restore();
}
function setPenWidth(value){
 const n=Math.round(clamp(Number.isFinite(value)?value:4,.25,48)*4)/4;
 $('penWidth').value=n;$('penWidthNumber').value=n;
}
$('penWidth').oninput=()=>setPenWidth(+$('penWidth').value);
$('penWidthNumber').oninput=()=>{if($('penWidthNumber').value!=='')$('penWidth').value=clamp($('penWidthNumber').valueAsNumber,.25,48)};
$('penWidthNumber').onchange=()=>setPenWidth($('penWidthNumber').valueAsNumber);
$('textSize').onchange=()=>{$('textSize').value=Math.round(clamp($('textSize').valueAsNumber||20,8,96))};

// Render from analysis values at the requested resolution; PNG export uses
// the same mapping as the screen and does not enlarge a screenshot bitmap.
function drawScene(target,v,s,list,w,h,scale=1,crop=null){
 const area=crop||{x:0,y:0,w,h};target.width=Math.max(1,Math.round(area.w*scale));target.height=Math.max(1,Math.round(area.h*scale));
 const g=target.getContext('2d'),lut=colorLut(s),mono=s.palette==='gray';g.fillStyle=mono?'#ffffff':'#0c0b12';g.fillRect(0,0,target.width,target.height);
 const ax=Math.max(LEFT,area.x),ay=Math.max(TOP,area.y),bx=Math.min(w,area.x+area.w),by=Math.min(h-BOTTOM,area.y+area.h);
 const rw=Math.max(0,Math.round((bx-ax)*scale)),rh=Math.max(0,Math.round((by-ay)*scale));
 if(rw&&rh){const im=g.createImageData(rw,rh),bins=Float64Array.from({length:rh},(_,y)=>clamp(pitchBin(pAt(ay+(y+.5)/scale,v,h)),0,959));
  for(let x=0;x<rw;x++){const sec=tAt(ax+(x+.5)/scale,v,w),t=clamp(sec*60,0,meta.rows-1);for(let y=0;y<rh;y++){const valid=sec>=0&&sec<=meta.duration,raw=valid?intensity(t,bins[y]):0,ref=s.palette==='reference',val=ref?raw*s.gain:(rawEncoding?legacyIntensity(raw,bins[y]):raw),col=lut[clamp(Math.round(val*4095),0,4095)],p=(y*rw+x)*4,a=valid&&ref&&s.peak&&peaks?intensity(t,bins[y],peaks)/255:0;im.data[p]=col[0]*(1-.6*a);im.data[p+1]=col[1]*(1-.8*a);im.data[p+2]=col[2]*(1-.2*a);im.data[p+3]=255}}
  g.putImageData(im,Math.round((ax-area.x)*scale),Math.round((ay-area.y)*scale));
 }
 g.scale(scale,scale);g.translate(-area.x,-area.y);
 g.save();g.beginPath();g.rect(0,TOP,w,h-TOP-BOTTOM);g.clip();let last=-100;const px=(h-TOP-BOTTOM)/(v.hi-v.lo);g.font='11px system-ui';g.textBaseline='middle';
 for(let m=Math.floor(v.hi+.5);m>=Math.ceil(v.lo-.5);m--){const y=yAt(m,v,h),a=yAt(m+.5,v,h),b=yAt(m-.5,v,h),black=[1,3,6,8,10].includes((m%12+12)%12);g.fillStyle=mono?(black?'#1d1d1f':'#ffffff'):(black?'#24202f':'#d5d0df');g.fillRect(77,a,30,b-a);g.strokeStyle=mono?'#777777':'#61566f';g.lineWidth=1;g.strokeRect(77,a,30,b-a);
  if(s.noteGrid){g.strokeStyle=mono?(m%12===0?'#00000032':'#00000016'):(m%12===0?'#ffffff55':'#ffffff29');g.beginPath();g.moveTo(LEFT,y);g.lineTo(w,y);g.stroke()}
  if(y>=TOP&&y<=h-BOTTOM&&y-last>=12&&(px>=12||!black)){g.fillStyle=mono?'#1d1d1f':'#ddd4e9';g.textAlign='right';g.fillText(s.axis==='note'?note(m):hz(m).toFixed(hz(m)<100?1:0),70,y);last=y}
 }
 g.restore();const tick=ticks(v,w);g.font='11px system-ui';g.textAlign='center';g.textBaseline='top';
 for(const sec of tick.values){const x=xAt(sec,v,w);if(s.timeGrid){g.strokeStyle=mono?'#00000030':'#ffffff35';g.beginPath();g.moveTo(x,TOP);g.lineTo(x,h-BOTTOM);g.stroke()}if(x<=w-25){g.fillStyle=mono?'#1d1d1f':'#bbb0ca';g.fillText(formatTime(sec,tick.digits,s.clock),x,h-BOTTOM+8)}}
 drawInk(g,v,w,h,list);g.setTransform(1,0,0,1,0,0);return target;
}
function render(){if(!samples)return;W=canvas.width;H=canvas.height;drawScene(cached,view(),style(),annotations,W,H);dirty=false;overlay()}
function overlay(){if(!cached.width||!samples)return;ctx.clearRect(0,0,W,H);ctx.drawImage(cached,0,0);const x=xAt(audio.currentTime,view(),W);if(x>=LEFT&&x<=W){ctx.strokeStyle=style().palette==='gray'?'#1d1d1f':'#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,TOP);ctx.lineTo(x,H-BOTTOM);ctx.stroke()}
 if(drag?.moved){if(['rect','line','highlight'].includes(drag.mode))drawInk(ctx,drag.view,W,H,[draft(drag)]);else if(['zoom','capture'].includes(drag.mode))selectionBox(drag.x,drag.y,drag.endX-drag.x,drag.endY-drag.y)}
 if(captureState)selectionBox(captureState.area.x,captureState.area.y,captureState.area.w,captureState.area.h);
}
function selectionBox(x,y,w,h){ctx.save();ctx.strokeStyle='#d4b8ff';ctx.lineWidth=1;ctx.setLineDash([6,4]);ctx.fillStyle='#b58cff19';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.restore()}
function resize(){canvas.width=Math.max(320,Math.floor(canvas.clientWidth));canvas.height=Math.max(400,Math.floor(canvas.clientHeight));W=canvas.width;H=canvas.height;changed()}new ResizeObserver(resize).observe(canvas);
function changed(){const mono=$('palette').value==='gray';gainLabel.firstChild.textContent=mono?'ความเข้มสัญญาณ (linear) ':'ความสว่าง (linear) ';$('gain').setAttribute('aria-label',mono?'ความเข้มสัญญาณแบบเชิงเส้น':'ความสว่างแบบเชิงเส้น');canvas.style.backgroundColor=mono?'#ffffff':'#0c0b12';dirty=true;invalidateCapture();surface.update()}
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
function setMode(name){
 modeName=name;for(const [id,m] of [['boxZoom','zoom'],['capture','capture']]){$(id).setAttribute('aria-pressed',String(name===m));$(id).style.background=name===m?'#1d1d1f':'';$(id).style.color=name===m?'#fff':''}
 if(['pan','rect','line','highlight','text'].includes(name))$('tool').value=name;
 $('textSettings').hidden=name!=='text';$('strokeSettings').hidden=name==='text';
 $('toolHint').textContent=name==='text'?'พิมพ์ข้อความ แล้วคลิกบนภาพเพื่อวาง · ขึ้นบรรทัดใหม่ได้':name==='pan'?'ลากเพื่อเลื่อนภาพ · คลิกเพื่อเลือกเวลา':'ลากบนภาพเพื่อเขียนกำกับ · ปรับขนาดได้ทีละ 0.25 px';
 canvas.style.cursor=name==='pan'?'grab':name==='text'?'text':'crosshair';drag=null;overlay();
}
$('tool').onchange=()=>setMode($('tool').value);$('boxZoom').onclick=()=>setMode(modeName==='zoom'?'pan':'zoom');$('capture').onclick=()=>{manual();audio.pause();setMode(modeName==='capture'?'pan':'capture')};
function point(e,full=false){const r=canvas.getBoundingClientRect();return {x:clamp((e.clientX-r.left)*W/r.width,full?0:LEFT,W),y:clamp((e.clientY-r.top)*H/r.height,full?0:TOP,full?H:H-BOTTOM)}}
function dataPoint(p,v){return {t:tAt(p.x,v,W),m:pAt(p.y,v,H)}}
function draft(d){const pts=d.mode==='highlight'?d.points:[dataPoint({x:d.x,y:d.y},d.view),dataPoint({x:d.endX,y:d.endY},d.view)];return {type:d.mode,color:d.color,width:d.width,strokePixels:true,points:pts}}
canvas.onpointerdown=e=>{if(!samples||e.button!==0||drag)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(modeName!=='capture'&&(x<LEFT||y<TOP||y>H-BOTTOM))return;const p=point(e,modeName==='capture');if(modeName==='text'&&!$('annotationText').value.trim()){$('toolHint').textContent='พิมพ์ข้อความก่อน แล้วคลิกตำแหน่งที่ต้องการบนภาพ';$('annotationText').focus();return}if(modeName!=='pan'){manual();audio.pause()}invalidateCapture();drag={...p,endX:p.x,endY:p.y,view:view(),mode:modeName,moved:false,color:$('ink').value,width:+$('penWidth').value,text:$('annotationText').value.trim().slice(0,240),fontSize:Math.round(clamp($('textSize').valueAsNumber||20,8,96)),points:[dataPoint(p,view())]};canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{const p=point(e,drag?.mode==='capture');if(!drag){if(p.x>LEFT)$('readout').textContent=`เวลา ${formatTime(tAt(p.x,view(),W))} · ${hz(pAt(p.y,view(),H)).toFixed(2)} Hz · โน้ตใกล้ที่สุด ${note(Math.round(pAt(p.y,view(),H)))}`;return}
 const d=drag,dx=p.x-d.x,dy=p.y-d.y;d.endX=p.x;d.endY=p.y;if(Math.hypot(dx,dy)>3)d.moved=true;if(!d.moved)return;manual();if(d.mode==='pan'){setTime(d.view.start-dx/(W-LEFT)*d.view.span,d.view.span);setPitch(d.view.lo+dy/(H-TOP-BOTTOM)*(d.view.hi-d.view.lo),d.view.hi-d.view.lo);syncZoom()}else{if(d.mode==='highlight')d.points.push(dataPoint(p,d.view));if(dirty)render();else overlay()}};
canvas.onpointerup=e=>{if(!drag)return;const d=drag;drag=null;canvas.releasePointerCapture(e.pointerId);const area={x:Math.min(d.x,d.endX),y:Math.min(d.y,d.endY),w:Math.abs(d.endX-d.x),h:Math.abs(d.endY-d.y)};
 if(d.moved&&d.mode==='capture'&&area.w>=8&&area.h>=8){setMode('pan');prepareCapture(area);return}
 if(d.moved&&d.mode==='zoom'&&area.w>8&&area.h>8){const lower=pAt(area.y+area.h,d.view,H),upper=pAt(area.y,d.view,H);setTime(tAt(area.x,d.view,W),area.w/(W-LEFT)*d.view.span);setPitch(lower,upper-lower);setMode('pan');syncZoom()}
 else if(d.moved&&['rect','line','highlight'].includes(d.mode)){editInk([...annotations,draft(d)])}
 else if(!d.moved&&d.mode==='text'){editInk([...annotations,{type:'text',color:d.color,text:d.text,fontSize:d.fontSize,points:[dataPoint({x:d.x,y:d.y},d.view)]}])}
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
$('downloadPNG').onclick=()=>{if(!captureState?.blob)return;const url=URL.createObjectURL(captureState.blob),a=document.createElement('a');a.href=url;a.download=(sourceName.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}._-]+/gu,'-')||'spectrogram')+'-spectrogram-selection.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
function isPlaybackSpace(e){if((e.code!=='Space'&&e.key!==' ')||e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return false;return !e.composedPath().some(el=>el instanceof HTMLElement&&(el.isContentEditable||el.matches('.lab-rail-button,textarea,select,input:not([type=range]):not([type=checkbox]):not([type=button])')))}
document.addEventListener('keydown',e=>{if(!isPlaybackSpace(e))return;e.preventDefault();e.stopPropagation();if(e.repeat||!samples||audio.readyState<1)return;if(audio.paused)audio.play().catch(()=>{$('status').textContent='กรุณากดปุ่มเล่นเสียงอีกครั้ง'});else audio.pause()},{capture:true});
document.addEventListener('keyup',e=>{if(isPlaybackSpace(e)){e.preventDefault();e.stopPropagation()}},{capture:true});
audio.addEventListener('seeked',()=>{$('seek').value=audio.currentTime;if($('follow').checked&&(audio.currentTime<start||audio.currentTime>start+span))position(audio.currentTime);overlay()});
audio.addEventListener('pause',()=>{$('seek').value=audio.currentTime;overlay()});$('follow').onchange=()=>{if($('follow').checked)position(audio.currentTime)};
async function init(){try{sourceName=document.querySelector('h1')?.textContent||sourceName;const packed=bytes(meta.data);meta.data='';const buf=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();samples=new Float32Array(buf);if(samples.length!==meta.rows*960)throw Error('จำนวนข้อมูลไม่ตรง');audio.src=URL.createObjectURL(new Blob([bytes(meta.audio)],{type:'audio/mpeg'}));meta.audio='';audio.addEventListener('loadedmetadata',()=>{audio.currentTime=15},{once:true});$('status').textContent='พร้อมใช้งาน · ออฟไลน์';resize();requestAnimationFrame(tick)}catch(e){$('status').textContent='เปิดไม่ได้: '+e.message}}
function tick(){let moved=false;if(!audio.paused&&Math.abs(audio.currentTime-lastPlay)>.04){if($('follow').checked&&(audio.currentTime>start+span*.85||audio.currentTime<start))position(audio.currentTime);$('seek').value=audio.currentTime;lastPlay=audio.currentTime;moved=true}if(dirty)render();else if(moved)overlay();surface.frame();requestAnimationFrame(tick)}
window.viewerTest={binPitch,pitchBin,hz,note,yForPitch,pitchForY,formatTime,get state(){return {...view(),rows:meta.rows,ready:!!samples,annotations:annotations.length}},sample:(frame,bin)=>samples[frame*960+bin]};
const surface=createSurface(()=>samples&&rawEncoding?{samples,peaks,rows:meta.rows,view:view(),style:style(),palettes,audio,duration:meta.duration,formatTime,zoomTime,zoomPitch,seekAt:t=>{audio.currentTime=clamp(t,0,meta.duration)},pan:(v,dt,dm)=>{manual();setTime(v.start+dt,v.span);setPitch(v.lo+dm,v.hi-v.lo);syncZoom()},seek:t=>{audio.currentTime=t;position(t)},follow:$('follow')}:null,canvas);
/* Desktop: common controls above; one persistent accordion section beside the plot. */
function mountLabWorkbench(){
 const main=canvas.closest('main');
 const setHeight=()=>{let h=window.innerHeight;try{h=window.parent.innerHeight||h}catch{}document.documentElement.style.setProperty('--lab-screen-height',Math.max(550,h)+'px')};
 setHeight();try{window.parent.addEventListener('resize',setHeight)}catch{window.addEventListener('resize',setHeight)}
 const tabs=main.querySelector('.view-tabs'),groups=[...main.querySelectorAll(':scope > .tools')],panel3d=$('panel3d');
 const hint=[...main.querySelectorAll(':scope > p')].find(p=>p.textContent.startsWith('Spacebar:'));
 if(!tabs||groups.length!==5||!panel3d||!hint)throw Error('Incomplete spectrogram controls');
 const [transport,zoom,appearance,annotation,capture]=groups;
 const top=document.createElement('section');top.className='lab-top';
 const grid=document.createElement('div');grid.className='lab-grid';
 const stage=document.createElement('section');stage.className='lab-stage';
 const aside=document.createElement('aside');aside.className='lab-sidebar';aside.setAttribute('aria-label','เครื่องมือข้างภาพ Spectrogram');
 const rail=document.createElement('nav');rail.className='lab-tool-rail';rail.setAttribute('aria-label','หมวดเครื่องมือปรับภาพ');
 main.prepend(top);top.append(tabs,transport);top.after(grid);grid.append(stage,aside);aside.append(rail);
 stage.append(panel3d,canvas,$('readout'),$('seek'),hint);
 const quick=document.createElement('div');quick.className='lab-quick-zoom';
 for(const [label,ids] of [['เวลา',['timeIn','timeOut']],['ระดับเสียง',['pitchIn','pitchOut']]]){
  const group=document.createElement('div');group.className='lab-zoom-set';
  const text=document.createElement('span');text.textContent=label;group.append(text);
  for(const id of ids)group.append($(id));quick.append(group);
 }
 top.append(quick);zoom.querySelectorAll('strong').forEach(el=>el.remove());
 const axes=document.createElement('div');axes.className='tools';axes.setAttribute('aria-label','แกนและเส้นกริด');
 for(const id of ['axis','timeFormat','noteGrid','timeGrid'])axes.append($(id).closest('label'));
 appearance.append(gainLabel,gainNumber);
 const controls3d=[...panel3d.querySelectorAll(':scope > .tools')];
 if(controls3d.length!==2)throw Error('Missing 3D controls');
 const specs=[
  ['colors','สีและความเข้ม','◐',[appearance]],
  ['axis','แกนและกริด','▦',[axes]],
  ['zoom','ซูมเพิ่มเติม','⌕',[zoom]],
  ['draw','เขียนกำกับ','✎',[annotation]],
  ['export','ส่งออก PNG','↓',[capture]],
  ['three','ปรับภาพ 3D','◇',controls3d]
 ];
 const buttons=new Map(),panels=new Map(),sections=new Map();let active=null;
 function select(name){
  active=name;
  for(const [id,panel] of panels){const selected=id===name;panel.hidden=!selected;buttons.get(id).setAttribute('aria-expanded',String(selected))}
 }
 for(const [id,label,symbol,items] of specs){
  const section=document.createElement('section');section.className='lab-tool-section';sections.set(id,section);
  const heading=document.createElement('h2');heading.className='lab-rail-heading';
  const button=document.createElement('button');button.type='button';button.className='lab-rail-button';
  button.id='lab-button-'+id;button.setAttribute('aria-controls','lab-panel-'+id);button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',label);
  const icon=document.createElement('span');icon.className='lab-rail-symbol';icon.setAttribute('aria-hidden','true');icon.textContent=symbol;
  const name=document.createElement('span');name.className='lab-rail-label';name.textContent=label;
  button.append(icon,name);heading.append(button);section.append(heading);rail.append(section);buttons.set(id,button);
  const panel=document.createElement('section');panel.id='lab-panel-'+id;panel.className='lab-panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-labelledby',button.id);
  section.append(panel);panels.set(id,panel);for(const item of items)panel.append(item);
  button.addEventListener('click',()=>select(id));
 }
 rail.addEventListener('keydown',e=>{
  // Arrow keys inside fields keep their normal editing and slider behavior.
  if(!e.target.matches('.lab-rail-button')||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();const visible=[...buttons].filter(([id])=>!sections.get(id).hidden).map(([,button])=>button);
  const cur=visible.indexOf(e.target),i=e.key==='Home'?0:e.key==='End'?visible.length-1:(cur+(e.key==='ArrowDown'?1:-1)+visible.length)%visible.length;visible[i]?.focus();
 });
 const sync=()=>{const is3d=!panel3d.hidden;for(const id of ['draw','export'])sections.get(id).hidden=is3d;sections.get('three').hidden=!is3d;if(active&&sections.get(active).hidden)select(is3d?'three':'colors')};
 new MutationObserver(sync).observe(panel3d,{attributes:true,attributeFilter:['hidden']});sync();
}
mountLabWorkbench();
syncZoom();if(payload){loadInk();init()}else{
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='analysis-ready'||samples)return;try{const d=e.data;sourceName=d.name||sourceName;meta.rows=d.rows;meta.duration=d.duration;samples=new Float32Array(d.values);rawEncoding=d.encoding==='raw-cqt-v1';peaks=d.peaks?new Uint8Array(d.peaks):null;if(peaks&&peaks.length!==samples.length)throw Error('ข้อมูลยอดเสียงไม่ครบ');if(samples.length!==meta.rows*960)throw Error('ข้อมูลวิเคราะห์ไม่ครบ');storageKey='musical-detail:'+d.key+':annotations:v1';loadInk();audio.src=URL.createObjectURL(d.audio);$('seek').max=meta.duration;start=0;span=Math.min(10,meta.duration);document.querySelector('h1').textContent=d.name;document.title=d.name+' · Musical Detail';$('status').textContent='พร้อมใช้งาน';syncZoom();resize();requestAnimationFrame(tick);parent.postMessage({type:'viewer-ready'},location.origin)}catch(error){parent.postMessage({type:'viewer-error',message:error.message},location.origin)}});
 new ResizeObserver(()=>parent.postMessage({type:'viewer-height',height:document.body.scrollHeight},location.origin)).observe(document.body);
 parent.postMessage({type:'viewer-listening'},location.origin);
}

