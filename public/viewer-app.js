'use strict';
import {amplitudeDB,dbUnit,dbRGB} from './signal-level.mjs?v=db-1';
import {drawAnnotations} from './annotation-render.mjs?v=db-1';
import {playReferenceNote} from './piano-reference.mjs?v=db-1';
import {referenceRGB,legacyIntensity} from './reference-color.mjs';
import {createSurface} from './surface-3d.mjs?v=memory-1';
import {t,setText,translate,initLanguage} from './i18n.mjs?v=memory-1';
import {validAnnotation,strokeWidth,strokeTypes,objectBounds,hitObject,translateObject} from './annotation-objects.mjs?v=db-1';
const $=id=>document.getElementById(id),audio=$('audio'),canvas=$('plot'),ctx=canvas.getContext('2d');
const payload=$('payload'),meta=payload?JSON.parse(payload.textContent):{rows:0,duration:0};payload?.remove();
const LEFT=108,TOP=12,BOTTOM=30,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const hz=m=>440*2**((m-69)/12),note=m=>names[((m%12)+12)%12]+(Math.floor(m/12)-1);
const binPitch=b=>15.5+(b+.5)/8,pitchBin=m=>(m-15.5)*8-.5;
let sourceName='spectrogram',samples,levels,peaks,rawEncoding=false,start=10,span=10,lo=15.5,hi=135.5,W=1000,H=700,dirty=true,lastPlay=-1,drag=null,modeName='pan';
const cached=document.createElement('canvas');
const view=()=>({start,span,lo,hi});
const yAt=(m,v,h)=>TOP+(v.hi-m)/(v.hi-v.lo)*(h-TOP-BOTTOM);
const pAt=(y,v,h)=>v.hi-(y-TOP)/(h-TOP-BOTTOM)*(v.hi-v.lo);
const xAt=(t,v,w)=>LEFT+(t-v.start)/v.span*(w-LEFT);
const tAt=(x,v,w)=>v.start+(x-LEFT)/(w-LEFT)*v.span;
const yForPitch=m=>yAt(m,view(),H),pitchForY=y=>pAt(y,view(),H);
const palettes={magma:[[0,0,4],[81,18,124],[183,55,121],[252,137,97],[252,253,191]],inferno:[[0,0,4],[87,16,110],[188,55,84],[249,142,9],[252,255,164]],viridis:[[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],gray:[[255,255,255],[192,192,192],[128,128,128],[64,64,64],[0,0,0]]};
const gainLabel=document.createElement('label');gainLabel.innerHTML='<span id="gainLabelText" data-i18n="gain"></span> <input id="gain" type="range" min="0" max="3" step="0.01" value="1" data-i18n-aria="gain"><output id="gainValue" for="gain">1.00×</output>';document.querySelector('.tools').append(gainLabel);
const gainNumber=document.createElement('input');gainNumber.type='number';gainNumber.id='gainNumber';gainNumber.min='0';gainNumber.max='3';gainNumber.step='0.01';gainNumber.value='1';gainNumber.dataset.i18nAria='gainNumber';gainNumber.style.width='75px';gainLabel.after(gainNumber);
function style(){return {levelMode:$('levelMode').value,dbFloor:+$('dbFloor').value,axis:$('axis').value,clock:$('timeFormat').value==='clock',palette:$('palette').value,gain:+$('gain').value,peak:$('peakEnhance').checked,noteGrid:$('noteGrid').checked,timeGrid:$('timeGrid').checked}}
function colorLut(s){if(s.levelMode==='db')return Array.from({length:4096},(_,i)=>dbRGB(10**((s.dbFloor+i/4095*-s.dbFloor)/20),s.palette==='reference'?null:palettes[s.palette],referenceRGB,s.dbFloor));if(s.palette==='reference')return Array.from({length:4096},(_,i)=>referenceRGB(i/4095));const stops=palettes[s.palette];return Array.from({length:4096},(_,i)=>{const v=Math.min(1,i/4095*s.gain)*4,j=Math.min(3,Math.floor(v)),f=v-j;return stops[j].map((a,c)=>Math.round(a*(1-f)+stops[j+1][c]*f))})}
function formatTime(sec,digits=2,clock=style().clock){const factor=10**digits,total=Math.round(Math.max(0,sec)*factor);if(!clock)return (total/factor).toFixed(digits)+'s';const mins=Math.floor(total/(60*factor)),rest=(total-mins*60*factor)/factor;return mins+':'+rest.toFixed(digits).padStart(digits?digits+3:2,'0')}
function ticks(v,w){const target=v.span/Math.max(2,Math.floor((w-LEFT)/100)),p=10**Math.floor(Math.log10(target)),step=[1,2,5,10].map(n=>n*p).find(n=>n>=target),a=[];for(let i=Math.ceil(v.start/step);i*step<=v.start+v.span;i++)a.push(i*step);return {values:a,digits:Math.max(0,-Math.floor(Math.log10(step)))}}
function bytes(s){const raw=atob(s),b=new Uint8Array(raw.length);for(let i=0;i<b.length;i++)b[i]=raw.charCodeAt(i);return b}
function intensity(t,b,data=samples){const t0=Math.floor(t),t1=Math.min(meta.rows-1,t0+1),b0=Math.floor(b),b1=Math.min(959,b0+1),x=t-t0,y=b-b0;return (data[t0*960+b0]*(1-y)+data[t0*960+b1]*y)*(1-x)+(data[t1*960+b0]*(1-y)+data[t1*960+b1]*y)*x}

let annotations=[],undoStack=[],redoStack=[],selectedIndex=-1,objectClipboard=null;
let storageKey='musical-detail:rosanna:960:19790:annotations:v1';
try{const value=JSON.parse(sessionStorage.getItem('muspec-object-clipboard'));if(validAnnotation(value))objectClipboard=value}catch{}
const annotationModes=['select',...strokeTypes,'text'];
const projectPoint=p=>({x:xAt(p.t,view(),W),y:yAt(p.m,view(),H)});
function measureText(text,size){ctx.save();ctx.font=`${size}px system-ui, sans-serif`;const width=ctx.measureText(text).width;ctx.restore();return width}
function loadInk(){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))annotations=saved.filter(validAnnotation)}catch{}annotationControls()}
function annotationControls(){
 for(const [id,enabled] of [['undo',undoStack.length],['redo',redoStack.length],['clearInk',annotations.length],['copyObject',selectedIndex>=0],['deleteObject',selectedIndex>=0],['pasteObject',!!objectClipboard]])$(id).disabled=!enabled;
}
function syncSelection(populate=true){
 if(!annotations[selectedIndex])selectedIndex=-1;
 const selected=annotations[selectedIndex],isText=modeName==='text'||(modeName==='select'&&selected?.type==='text');
 $('textSettings').hidden=!isText;$('strokeSettings').hidden=isText;
 if(selected&&populate){
  $('ink').value=selected.color;
  if(selected.type==='text'){$('annotationText').value=selected.text;$('textSize').value=selected.fontSize}
  else setPenWidth(strokeWidth(selected));
 }
 setText($('selectionInfo'),selected?'selectedObject':'nothingSelected',{type:selected?t(selected.type):''});
 for(const button of $('inkPresets').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.color===$('ink').value));
 setText($('toolHint'),modeName==='select'?(selected?.type==='text'?'editTextHint':'selectHint'):modeName==='text'?'textHint':modeName==='pan'?'panHint':['ellipse','rect'].includes(modeName)?'shapeHint':'drawHint');
 annotationControls();
}
function saveInk(){try{localStorage.setItem(storageKey,JSON.stringify(annotations));setText($('annotationInfo'),'annotationSaved',{count:annotations.length})}catch{setText($('annotationInfo'),'annotationStorageError')}annotationControls()}
function editInk(next,{before=annotations,selection=selectedIndex,previousSelection=selectedIndex}={}){
 undoStack.push({items:before,selection:previousSelection});if(undoStack.length>100)undoStack.shift();redoStack=[];annotations=next;selectedIndex=selection;saveInk();syncSelection();changed();
}
function undoInk(){if(!undoStack.length)return;cancelDrag();redoStack.push({items:annotations,selection:selectedIndex});const old=undoStack.pop();annotations=old.items;selectedIndex=old.selection;saveInk();syncSelection();changed()}
function redoInk(){if(!redoStack.length)return;cancelDrag();undoStack.push({items:annotations,selection:selectedIndex});const next=redoStack.pop();annotations=next.items;selectedIndex=next.selection;saveInk();syncSelection();changed()}
$('undo').onclick=undoInk;$('redo').onclick=redoInk;
$('clearInk').onclick=()=>editInk([],{selection:-1});
function updateSelected(patch){if(modeName!=='select'||selectedIndex<0)return;const old=annotations[selectedIndex],next={...old,...patch};if(validAnnotation(next)&&JSON.stringify(old)!==JSON.stringify(next))editInk(annotations.map((a,i)=>i===selectedIndex?next:a))}
function deleteObject(){if(selectedIndex<0)return;editInk(annotations.filter((_,i)=>i!==selectedIndex),{selection:-1})}
function copyObject(){if(selectedIndex<0)return;objectClipboard=structuredClone(annotations[selectedIndex]);try{sessionStorage.setItem('muspec-object-clipboard',JSON.stringify(objectClipboard))}catch{}annotationControls();setText($('selectionInfo'),'objectCopied')}
function pasteObject(){
 if(!objectClipboard||!samples)return;manual();audio.pause();
 const a=structuredClone(objectClipboard),anchor=projectPoint(a.points[0]);
 const inView=anchor.x>=LEFT&&anchor.x<W-36&&anchor.y>=TOP&&anchor.y<H-BOTTOM-36;
 let dt=inView?18/(W-LEFT)*span:start+span*.25-a.points[0].t;
 let dm=inView?-18/(H-TOP-BOTTOM)*(hi-lo):hi-(hi-lo)*.25-a.points[0].m;
 if(!$('panel3d').hidden){a.points=surface.anchorObject(a).points;({dt,dm}=surface.pasteOffset(a.points[0]))}
 const item=translateObject(a,dt,dm,meta.duration);setMode('select');editInk([...annotations,item],{selection:annotations.length});($('panel3d').hidden?canvas:$('surface3d')).focus({preventScroll:true});
}
$('copyObject').onclick=copyObject;$('pasteObject').onclick=pasteObject;$('deleteObject').onclick=deleteObject;
for(const [name,color] of [['ink','#1d1d1f'],['paper','#ffffff'],['coral','#ef4444'],['amber','#f59e0b'],['mint','#10b981'],['sky','#0ea5e9'],['violet','#8b5cf6'],['rose','#ec4899']]){
 const button=document.createElement('button');button.type='button';button.className='ink-swatch';button.dataset.color=color;button.dataset.i18nAria=name;button.dataset.i18nTitle=name;button.style.setProperty('--swatch',color);button.setAttribute('aria-pressed','false');
 button.onclick=()=>{$('ink').value=color;updateSelected({color});syncSelection(false)};$('inkPresets').append(button);
}
$('ink').onchange=()=>{updateSelected({color:$('ink').value});syncSelection(false)};
$('annotationText').onchange=()=>{const text=$('annotationText').value.trim().slice(0,240);if(text)updateSelected({text});else if(annotations[selectedIndex]?.type==='text')syncSelection()};
annotationControls();
function drawInk(g,v,w,h,list){
 g.save();g.beginPath();g.rect(LEFT,TOP,w-LEFT,h-TOP-BOTTOM);g.clip();
 drawAnnotations(g,list,p=>({x:xAt(p.t,v,w),y:yAt(p.m,v,h)}));
 g.restore();
}
function setPenWidth(value){
 const n=Math.round(clamp(Number.isFinite(value)?value:4,.25,48)*4)/4;
 $('penWidth').value=n;$('penWidthNumber').value=n;
}
$('penWidth').oninput=()=>setPenWidth(+$('penWidth').value);
$('penWidthNumber').oninput=()=>{if($('penWidthNumber').value!=='')$('penWidth').value=clamp($('penWidthNumber').valueAsNumber,.25,48)};
$('penWidthNumber').onchange=()=>{setPenWidth($('penWidthNumber').valueAsNumber);updateSelected({width:+$('penWidth').value,strokePixels:true})};
$('penWidth').onchange=()=>updateSelected({width:+$('penWidth').value,strokePixels:true});
$('textSize').onchange=()=>{$('textSize').value=Math.round(clamp($('textSize').valueAsNumber||20,8,96));updateSelected({fontSize:+$('textSize').value})};

// Render from analysis values at the requested resolution; PNG export uses
// the same mapping as the screen and does not enlarge a screenshot bitmap.
function drawScene(target,v,s,list,w,h,scale=1,crop=null){
 const area=crop||{x:0,y:0,w,h};target.width=Math.max(1,Math.round(area.w*scale));target.height=Math.max(1,Math.round(area.h*scale));
 const g=target.getContext('2d'),lut=colorLut(s),mono=s.palette==='gray';g.fillStyle=mono?'#ffffff':'#0c0b12';g.fillRect(0,0,target.width,target.height);
 const ax=Math.max(LEFT,area.x),ay=Math.max(TOP,area.y),bx=Math.min(w,area.x+area.w),by=Math.min(h-BOTTOM,area.y+area.h);
 const rw=Math.max(0,Math.round((bx-ax)*scale)),rh=Math.max(0,Math.round((by-ay)*scale));
 if(rw&&rh){const im=g.createImageData(rw,rh),bins=Float64Array.from({length:rh},(_,y)=>clamp(pitchBin(pAt(ay+(y+.5)/scale,v,h)),0,959));
  for(let x=0;x<rw;x++){const sec=tAt(ax+(x+.5)/scale,v,w),t=clamp(sec*60,0,meta.rows-1);for(let y=0;y<rh;y++){const valid=sec>=0&&sec<=meta.duration,raw=valid?intensity(t,bins[y]):0,ref=s.palette==='reference',val=s.levelMode==='db'?dbUnit(valid?intensity(t,bins[y],levels):0,s.dbFloor):ref?raw*s.gain:(rawEncoding?legacyIntensity(raw,bins[y]):raw),col=lut[clamp(Math.round(val*4095),0,4095)],p=(y*rw+x)*4,a=s.levelMode!=='db'&&valid&&ref&&s.peak&&peaks?intensity(t,bins[y],peaks)/255:0;im.data[p]=col[0]*(1-.6*a);im.data[p+1]=col[1]*(1-.8*a);im.data[p+2]=col[2]*(1-.2*a);im.data[p+3]=255}}
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
 drawInk(g,v,w,h,list);if(s.levelMode==='db'){g.font='11px system-ui';g.textAlign='right';g.textBaseline='top';g.fillStyle=mono?'#111':'#fff';g.strokeStyle=mono?'#fff':'#111';g.lineWidth=3;const label=`dBFS · ${s.dbFloor} … 0`;g.strokeText(label,w-10,TOP+5);g.fillText(label,w-10,TOP+5)}g.setTransform(1,0,0,1,0,0);return target;
}
function render(){if(!samples)return;W=canvas.width;H=canvas.height;drawScene(cached,view(),style(),annotations,W,H);dirty=false;overlay()}
function overlay(){if(!cached.width||!samples)return;ctx.clearRect(0,0,W,H);ctx.drawImage(cached,0,0);const x=xAt(audio.currentTime,view(),W);if(x>=LEFT&&x<=W){ctx.strokeStyle=style().palette==='gray'?'#1d1d1f':'#fff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,TOP);ctx.lineTo(x,H-BOTTOM);ctx.stroke()}
 if(drag?.moved){if(strokeTypes.includes(drag.mode))drawInk(ctx,drag.view,W,H,[draft(drag)]);else if(['zoom','capture'].includes(drag.mode))selectionBox(drag.x,drag.y,drag.endX-drag.x,drag.endY-drag.y)}
 if(modeName==='select'&&selectedIndex>=0){const b=objectBounds(annotations[selectedIndex],projectPoint,measureText);ctx.save();ctx.beginPath();ctx.rect(LEFT,TOP,W-LEFT,H-TOP-BOTTOM);ctx.clip();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);ctx.strokeStyle='#0071e3';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);ctx.restore()}
 if(captureState)selectionBox(captureState.area.x,captureState.area.y,captureState.area.w,captureState.area.h);
}
function selectionBox(x,y,w,h){ctx.save();ctx.strokeStyle='#d4b8ff';ctx.lineWidth=1;ctx.setLineDash([6,4]);ctx.fillStyle='#b58cff19';ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.restore()}
function updateLevelUI(){
 const db=$('levelMode').value==='db';$('dbFloorControl').hidden=!db;$('levelLegend').hidden=!db||!$('panel3d').hidden;
 for(const id of ['gain','gainNumber','peakEnhance'])$(id).disabled=db;
 setText($('levelHelp'),db?'dbHelp':'cqtHelp');
 if(db){const s=style(),colors=Array.from({length:25},(_,i)=>{const rgb=dbRGB(10**((s.dbFloor+i/24*-s.dbFloor)/20),s.palette==='reference'?null:palettes[s.palette],referenceRGB,s.dbFloor);return `rgb(${rgb.map(Math.round).join(',')})`});$('levelGradient').style.background=`linear-gradient(to right,${colors.join(',')})`;$('levelTicks').replaceChildren(...[s.dbFloor,s.dbFloor*2/3,s.dbFloor/3,0].map(n=>{const el=document.createElement('span');el.textContent=n;return el}))}
}
function resize(){canvas.width=Math.max(320,Math.floor(canvas.clientWidth));canvas.height=Math.max(400,Math.floor(canvas.clientHeight));W=canvas.width;H=canvas.height;changed()}new ResizeObserver(resize).observe(canvas);
function changed(){updateLevelUI();const mono=$('palette').value==='gray';setText($('gainLabelText'),mono?'inkGain':'gain');$('gain').dataset.i18nAria=mono?'inkGain':'gain';$('gain').setAttribute('aria-label',t(mono?'inkGain':'gain'));canvas.style.backgroundColor=mono?'#ffffff':'#0c0b12';dirty=true;invalidateCapture();surface.update()}
function syncZoom(redraw=true){for(const [id,value,text] of [['span',String(span),span.toFixed(2)],['range',`${lo},${hi}`,`${note(Math.round(lo))}–${note(Math.round(hi))} (${t('zoomed')})`]]){const select=$(id);select.querySelector('option[data-custom]')?.remove();if(![...select.options].some(o=>o.value===value)){const o=new Option(text,value);o.dataset.custom='1';select.add(o)}select.value=value}
 setText($('zoomInfo'),'zoomInfo',{start:formatTime(start),end:formatTime(start+span),range:(hi-lo).toFixed(1)});if(redraw)changed()}
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
function cancelDrag(){if(drag?.mode==='move')annotations=drag.before;drag=null;dirty=true;surface.cancelAnnotation()}
function setMode(name){
 cancelDrag();modeName=name;
 for(const [id,m] of [['boxZoom','zoom'],['capture','capture']]){$(id).setAttribute('aria-pressed',String(name===m));$(id).style.background=name===m?'#1d1d1f':'';$(id).style.color=name===m?'#fff':''}
 if(['pan',...annotationModes].includes(name))$('tool').value=name;
 if(name!=='select')selectedIndex=-1;
 canvas.style.cursor=name==='pan'?'grab':name==='text'?'text':name==='select'?'default':'crosshair';syncSelection();overlay();surface.repaint();
}
$('tool').onchange=()=>setMode($('tool').value);$('boxZoom').onclick=()=>setMode(modeName==='zoom'?'pan':'zoom');$('capture').onclick=()=>{manual();audio.pause();setMode(modeName==='capture'?'pan':'capture')};
function point(e,full=false){const r=canvas.getBoundingClientRect();return {x:clamp((e.clientX-r.left)*W/r.width,full?0:LEFT,W),y:clamp((e.clientY-r.top)*H/r.height,full?0:TOP,full?H:H-BOTTOM)}}
function dataPoint(p,v){return {t:tAt(p.x,v,W),m:pAt(p.y,v,H)}}
function hitIndex(p){for(let i=annotations.length-1;i>=0;i--)if(hitObject(annotations[i],p,projectPoint,measureText))return i;return -1}
function draft(d){const pts=d.mode==='highlight'?d.points:[dataPoint({x:d.x,y:d.y},d.view),dataPoint({x:d.endX,y:d.endY},d.view)];return {type:d.mode,color:d.color,width:d.width,strokePixels:true,points:pts}}
canvas.onpointerdown=e=>{
 if(!samples||e.button!==0||drag)return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
 if(modeName!=='capture'&&x>=77&&x<107&&y>=TOP&&y<=H-BOTTOM){referenceKey(clamp(Math.round(pAt(y,view(),H)),16,135));return}
 if(modeName!=='capture'&&(x<LEFT||y<TOP||y>H-BOTTOM))return;
 const p=point(e,modeName==='capture');
 if(modeName==='text'&&!$('annotationText').value.trim()){setText($('toolHint'),'emptyText');$('annotationText').focus();return}
 canvas.focus({preventScroll:true});if(modeName!=='pan'){manual();audio.pause()}invalidateCapture();
 if(modeName==='select'){
  selectedIndex=hitIndex(p);syncSelection();dirty=true;
  if(selectedIndex<0)return;
  drag={...p,endX:p.x,endY:p.y,view:view(),mode:'move',moved:false,before:annotations,index:selectedIndex,item:annotations[selectedIndex]};
 }else drag={...p,endX:p.x,endY:p.y,view:view(),mode:modeName,moved:false,color:$('ink').value,width:+$('penWidth').value,text:$('annotationText').value.trim().slice(0,240),fontSize:Math.round(clamp($('textSize').valueAsNumber||20,8,96)),points:[dataPoint(p,view())]};
 canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove=e=>{
 if(!drag&&modeName!=='capture'){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(x>=77&&x<107&&y>=TOP&&y<=H-BOTTOM){canvas.style.cursor='pointer';return}}
 if(!drag)canvas.style.cursor=modeName==='pan'?'grab':modeName==='text'?'text':modeName==='select'?'default':'crosshair';
 const p=point(e,drag?.mode==='capture');
 if(!drag){if(p.x>LEFT){setText($('readout'),'readout',{time:formatTime(tAt(p.x,view(),W)),hz:hz(pAt(p.y,view(),H)).toFixed(2),note:note(Math.round(pAt(p.y,view(),H)))});const frame=clamp(tAt(p.x,view(),W)*60,0,meta.rows-1),bin=clamp(pitchBin(pAt(p.y,view(),H)),0,959),db=style().levelMode==='db',value=db?amplitudeDB(intensity(frame,bin,levels)):intensity(frame,bin);$('readout').append(` · ${Number.isFinite(value)?value.toFixed(2):'−∞'} ${db?'dBFS':'CQT'}`)}if(modeName==='select')canvas.style.cursor=hitIndex(p)>=0?'move':'default';return}
 const d=drag;
 if(e.shiftKey&&['rect','ellipse'].includes(d.mode)){const sx=p.x<d.x?-1:1,sy=p.y<d.y?-1:1,side=Math.min(Math.max(Math.abs(p.x-d.x),Math.abs(p.y-d.y)),sx>0?W-d.x:d.x-LEFT,sy>0?H-BOTTOM-d.y:d.y-TOP);p.x=d.x+sx*side;p.y=d.y+sy*side}
 const dx=p.x-d.x,dy=p.y-d.y;d.endX=p.x;d.endY=p.y;if(Math.hypot(dx,dy)>3)d.moved=true;if(!d.moved)return;manual();
 if(d.mode==='move'){
  const item=translateObject(d.item,dx/(W-LEFT)*d.view.span,-dy/(H-TOP-BOTTOM)*(d.view.hi-d.view.lo),meta.duration);
  annotations=d.before.map((a,i)=>i===d.index?item:a);dirty=true;
 }else if(d.mode==='pan'){setTime(d.view.start-dx/(W-LEFT)*d.view.span,d.view.span);setPitch(d.view.lo+dy/(H-TOP-BOTTOM)*(d.view.hi-d.view.lo),d.view.hi-d.view.lo);syncZoom()}
 else{if(d.mode==='highlight')d.points.push(dataPoint(p,d.view));if(dirty)render();else overlay()}
};
canvas.onpointerup=e=>{
 if(!drag)return;const d=drag;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 const area={x:Math.min(d.x,d.endX),y:Math.min(d.y,d.endY),w:Math.abs(d.endX-d.x),h:Math.abs(d.endY-d.y)};
 if(d.mode==='move'){if(d.moved)editInk(annotations,{before:d.before});return}
 if(d.moved&&d.mode==='capture'&&area.w>=8&&area.h>=8){setMode('pan');prepareCapture(area);return}
 if(d.moved&&d.mode==='zoom'&&area.w>8&&area.h>8){const lower=pAt(area.y+area.h,d.view,H),upper=pAt(area.y,d.view,H);setTime(tAt(area.x,d.view,W),area.w/(W-LEFT)*d.view.span);setPitch(lower,upper-lower);setMode('pan');syncZoom()}
 else if(d.moved&&strokeTypes.includes(d.mode)){setMode('select');editInk([...annotations,draft(d)],{selection:annotations.length})}
 else if(!d.moved&&d.mode==='text'){setMode('select');editInk([...annotations,{type:'text',color:d.color,text:d.text,fontSize:d.fontSize,points:[dataPoint({x:d.x,y:d.y},d.view)]}],{selection:annotations.length})}
 else if(!d.moved&&d.mode==='pan'){audio.currentTime=clamp(tAt(d.x,view(),W),0,meta.duration)}dirty=true;
};
canvas.onpointercancel=cancelDrag;
function editingField(e){return e.composedPath().some(el=>el instanceof HTMLElement&&(el.isContentEditable||el.matches('input,textarea,select')))}
document.addEventListener('keydown',e=>{
 if(e.isComposing)return;
 if(e.key==='Escape'&&isExpanded()){if(!document.fullscreenElement)leaveFullscreen();return}
 if(editingField(e))return;
 if(e.key==='Escape'){cancelDrag();selectedIndex=-1;setMode(annotationModes.includes(modeName)?'select':'pan');invalidateCapture();return}
 if(!annotationModes.includes(modeName)||drag||surface.annotating)return;
 const command=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
 if(command&&key==='c'&&selectedIndex>=0){e.preventDefault();copyObject()}
 else if(command&&key==='v'&&objectClipboard){e.preventDefault();pasteObject()}
 else if(command&&key==='z'){e.preventDefault();e.shiftKey?redoInk():undoInk()}
 else if(command&&key==='y'){e.preventDefault();redoInk()}
 else if(!command&&(e.key==='Delete'||e.key==='Backspace')&&selectedIndex>=0){e.preventDefault();deleteObject()}
});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!samples||drag)return;const p=point(e),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?H:1),factor=Math.exp(clamp(delta,-300,300)*.002);if(e.ctrlKey)zoomPitch(factor,pAt(p.y,view(),H));else zoomTime(factor,tAt(p.x,view(),W))},{passive:false});

let captureState=null,captureToken=0;
function invalidateCapture(){if(!captureState)return;captureState=null;captureToken++;$('copyPNG').disabled=true;$('downloadPNG').disabled=true;setText($('captureInfo'),'captureStale')}
async function prepareCapture(area){const token=++captureToken,snapshot={area,view:view(),style:style(),ink:structuredClone(annotations),w:W,h:H};captureState=snapshot;$('copyPNG').disabled=true;$('downloadPNG').disabled=true;setText($('captureInfo'),'captureWorking');overlay();await new Promise(r=>setTimeout(r,20));if(token!==captureToken)return;
 try{const requested=+$('exportScale').value,scale=Math.min(requested,8192/area.w,8192/area.h,Math.sqrt(16000000/(area.w*area.h)));const out=drawScene(document.createElement('canvas'),snapshot.view,snapshot.style,snapshot.ink,W,H,scale,area);const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error(t('captureFailed'))),'image/png'));if(token!==captureToken)return;snapshot.blob=blob;snapshot.width=out.width;snapshot.height=out.height;$('copyPNG').disabled=false;$('downloadPNG').disabled=false;setText($('captureInfo'),'captureReady',{width:out.width,height:out.height});out.width=out.height=1}catch(e){setText($('captureInfo'),'errorDetail',{message:e.message})}
}
$('exportScale').onchange=()=>{if(captureState)prepareCapture(captureState.area)};
$('copyPNG').onclick=async()=>{const selected=captureState;if(!selected?.blob)return;try{if(!navigator.clipboard?.write||!window.ClipboardItem)throw Error(t('clipboardFailed'));await navigator.clipboard.write([new ClipboardItem({'image/png':selected.blob})]);setText($('captureInfo'),'captureCopied',{width:selected.width,height:selected.height})}catch(e){setText($('captureInfo'),'clipboardFailed')}};
$('downloadPNG').onclick=()=>{if(!captureState?.blob)return;const url=URL.createObjectURL(captureState.blob),a=document.createElement('a');a.href=url;a.download=(sourceName.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}._-]+/gu,'-')||'spectrogram')+'-spectrogram-selection.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
function isPlaybackSpace(e){if((e.code!=='Space'&&e.key!==' ')||e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return false;return !e.composedPath().some(el=>el instanceof HTMLElement&&(el.isContentEditable||el.matches('button,textarea,select,input')))}
document.addEventListener('keydown',e=>{if(!isPlaybackSpace(e))return;e.preventDefault();e.stopPropagation();if(e.repeat||!samples||audio.readyState<1)return;if(audio.paused)audio.play().catch(()=>{setText($('status'),'playAgain')});else audio.pause()},{capture:true});
document.addEventListener('keyup',e=>{if(isPlaybackSpace(e)){e.preventDefault();e.stopPropagation()}},{capture:true});
audio.addEventListener('seeked',()=>{$('seek').value=audio.currentTime;if($('follow').checked&&(audio.currentTime<start||audio.currentTime>start+span))position(audio.currentTime);overlay()});
audio.addEventListener('pause',()=>{$('seek').value=audio.currentTime;overlay()});$('follow').onchange=()=>{if($('follow').checked)position(audio.currentTime)};
async function init(){try{sourceName=document.querySelector('h1')?.textContent||sourceName;const packed=bytes(meta.data);meta.data='';const buf=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();samples=new Float32Array(buf);if(samples.length!==meta.rows*960)throw Error(t('dataError'));audio.src=URL.createObjectURL(new Blob([bytes(meta.audio)],{type:'audio/mpeg'}));meta.audio='';audio.addEventListener('loadedmetadata',()=>{audio.currentTime=15},{once:true});setText($('status'),'ready');resize();requestAnimationFrame(tick)}catch(e){setText($('status'),'errorDetail',{message:e.message})}}
function tick(){let moved=false;if(!audio.paused&&Math.abs(audio.currentTime-lastPlay)>.04){if($('follow').checked&&(audio.currentTime>start+span*.85||audio.currentTime<start))position(audio.currentTime);$('seek').value=audio.currentTime;lastPlay=audio.currentTime;moved=true}if(dirty)render();else if(moved)overlay();surface.frame();requestAnimationFrame(tick)}
window.viewerTest={binPitch,pitchBin,hz,note,yForPitch,pitchForY,formatTime,get state(){return {...view(),rows:meta.rows,ready:!!samples,annotations:annotations.length}},sample:(frame,bin)=>samples[frame*960+bin],amplitude:(frame,bin)=>levels?.[frame*960+bin]};
async function referenceKey(midi){
 try{const result=await playReferenceNote(midi);if(result)setText($('pianoFeedback'),'pianoPlaying',{note:note(midi),hz:result.frequency.toFixed(2)})}
 catch{setText($('pianoFeedback'),'pianoUnavailable')}
}
const annotationBridge={
 get mode(){return modeName},get items(){return annotations},get selection(){return selectedIndex},
 get style(){return {color:$('ink').value,width:+$('penWidth').value,strokePixels:true,text:$('annotationText').value.trim().slice(0,240),fontSize:Math.round(clamp($('textSize').valueAsNumber||20,8,96))}},
 select(index){selectedIndex=index;syncSelection();dirty=true},commit:editInk,setMode,
 pause(){manual();audio.pause();invalidateCapture()},
 emptyText(){setText($('toolHint'),'emptyText');$('annotationText').focus()},
 miss(){setText($('toolHint'),'annotation3dMiss')}
};
const surface=createSurface(()=>samples&&rawEncoding?{annotation:annotationBridge,playReference:referenceKey,samples,levels,peaks,rows:meta.rows,view:view(),style:style(),palettes,audio,duration:meta.duration,formatTime,zoomTime,zoomPitch,seekAt:t=>{audio.currentTime=clamp(t,0,meta.duration)},pan:(v,dt,dm)=>{manual();setTime(v.start+dt,v.span);setPitch(v.lo+dm,v.hi-v.lo);syncZoom()},seek:t=>{audio.currentTime=t;position(t)},follow:$('follow')}:null,canvas);
window.viewerTest.surface=()=>surface.inspect();
function isExpanded(){return !!document.fullscreenElement||$('lab-stage')?.classList.contains('expanded')}
async function leaveFullscreen(){
 if(document.fullscreenElement)await document.exitFullscreen();
 $('lab-stage').classList.remove('expanded');parent.postMessage({type:'viewer-expanded',expanded:false},location.origin);
 $('fullscreen').focus({preventScroll:true});
}
async function enterFullscreen(){
 if(isExpanded())return leaveFullscreen();
 setText($('fullscreenTitle'),'workspace');
 try{if(!document.fullscreenEnabled||!$('lab-stage').requestFullscreen)throw Error('unavailable');await $('lab-stage').requestFullscreen()}
 catch{$('lab-stage').classList.add('expanded');setText($('fullscreenTitle'),'webExpanded');parent.postMessage({type:'viewer-expanded',expanded:true},location.origin)}
}
/* Desktop: common controls above; one persistent accordion section beside the plot. */
function mountLabWorkbench(){
 const main=canvas.closest('main');
 const setHeight=()=>{let h=window.innerHeight;try{h=window.parent.innerHeight||h}catch{}document.documentElement.style.setProperty('--lab-screen-height',Math.max(550,h)+'px')};
 setHeight();try{window.parent.addEventListener('resize',setHeight)}catch{window.addEventListener('resize',setHeight)}
 const tabs=main.querySelector('.view-tabs'),groups=[...main.querySelectorAll(':scope > .tools')],panel3d=$('panel3d');
 const hint=$('gestureHint');
 if(!tabs||groups.length!==5||!panel3d||!hint)throw Error('Incomplete spectrogram controls');
 const [transport,zoom,appearance,annotation,capture]=groups;
 const top=document.createElement('section');top.className='lab-top';
 const grid=document.createElement('div');grid.className='lab-grid';
 const stage=document.createElement('section');stage.className='lab-stage';stage.id='lab-stage';
 const fullscreenBar=document.createElement('div');fullscreenBar.className='fullscreen-bar';fullscreenBar.innerHTML='<span id="fullscreenTitle" data-i18n="workspace"></span><button id="exitFullscreen" data-i18n="exitFullscreen"></button>';stage.append(fullscreenBar);
 const aside=document.createElement('aside');aside.className='lab-sidebar';aside.dataset.i18nAria='workspace';
 const rail=document.createElement('nav');rail.className='lab-tool-rail';rail.dataset.i18nAria='workspace';
 main.prepend(top);top.append(tabs,transport);top.after(grid);grid.append(stage,aside);aside.append(rail);
 stage.append(panel3d,canvas,$('readout'),$('seek'),hint);
 const quick=document.createElement('div');quick.className='lab-quick-zoom';
 for(const [label,ids] of [['time',['timeIn','timeOut']],['pitch',['pitchIn','pitchOut']]]){
  const group=document.createElement('div');group.className='lab-zoom-set';
  const text=document.createElement('span');setText(text,label);group.append(text);
  for(const id of ids)group.append($(id));quick.append(group);
 }
 const fullscreenButton=document.createElement('button');fullscreenButton.id='fullscreen';fullscreenButton.dataset.i18n='fullscreen';quick.append(fullscreenButton);fullscreenButton.onclick=enterFullscreen;$('exitFullscreen').onclick=leaveFullscreen;
 document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)fullscreenButton.focus({preventScroll:true})});
 top.append(quick);zoom.querySelectorAll('strong').forEach(el=>el.remove());
 const axes=document.createElement('div');axes.className='tools';axes.dataset.i18nAria='axes';
 for(const id of ['axis','axisSide3d','timeFormat','noteGrid','timeGrid'])axes.append($(id).closest('label'));
 const scaleControls=document.createElement('div');scaleControls.className='level-controls';scaleControls.innerHTML='<label><span data-i18n="levelScale"></span><select id="levelMode"><option value="cqt">CQT</option><option value="db" disabled>dBFS</option></select></label><label id="dbFloorControl" hidden><span data-i18n="dbRange"></span><select id="dbFloor"><option value="-60">−60 … 0 dBFS</option><option value="-90" selected>−90 … 0 dBFS</option><option value="-120">−120 … 0 dBFS</option></select></label><p id="levelHelp" class="muted"></p>';axes.prepend(scaleControls);
 const legend=document.createElement('div');legend.id='levelLegend';legend.hidden=true;legend.innerHTML='<span>dBFS</span><div id="levelGradient"></div><span id="levelTicks"></span>';canvas.after(legend);
 const pianoHelp=document.createElement('p');pianoHelp.id='pianoFeedback';pianoHelp.className='muted';pianoHelp.setAttribute('role','status');pianoHelp.dataset.i18n='pianoHint';axes.append(pianoHelp);
 const ink3dHint=document.createElement('p');ink3dHint.id='ink3dHint';ink3dHint.className='muted';ink3dHint.dataset.i18n='annotation3dHint';annotation.append(ink3dHint);
 appearance.append(gainLabel,gainNumber);
 const controls3d=[...panel3d.querySelectorAll(':scope > .tools')];
 if(controls3d.length!==1)throw Error('Missing 3D controls');
 const specs=[
  ['colors','colors','◐',[appearance]],
  ['axis','axes','▦',[axes]],
  ['zoom','zoom','⌕',[zoom]],
  ['draw','draw','✎',[annotation]],
  ['export','export','↓',[capture]],
  ['three','three','◇',controls3d]
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
  button.id='lab-button-'+id;button.setAttribute('aria-controls','lab-panel-'+id);button.setAttribute('aria-expanded','false');button.dataset.i18nAria=label;
  const icon=document.createElement('span');icon.className='lab-rail-symbol';icon.setAttribute('aria-hidden','true');icon.textContent=symbol;
  const name=document.createElement('span');name.className='lab-rail-label';setText(name,label);
  button.append(icon,name);heading.append(button);section.append(heading);rail.append(section);buttons.set(id,button);
  const panel=document.createElement('section');panel.id='lab-panel-'+id;panel.className='lab-panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-labelledby',button.id);
  section.append(panel);panels.set(id,panel);for(const item of items)panel.append(item);
  button.addEventListener('click',()=>{select(id);if(id==='draw'&&!annotationModes.includes(modeName))setMode('select')});
 }
 rail.addEventListener('keydown',e=>{
  // Arrow keys inside fields keep their normal editing and slider behavior.
  if(!e.target.matches('.lab-rail-button')||!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();const visible=[...buttons].filter(([id])=>!sections.get(id).hidden).map(([,button])=>button);
  const cur=visible.indexOf(e.target),i=e.key==='Home'?0:e.key==='End'?visible.length-1:(cur+(e.key==='ArrowDown'?1:-1)+visible.length)%visible.length;visible[i]?.focus();
 });
 const sync=()=>{const is3d=!panel3d.hidden;$('levelLegend').hidden=is3d||$('levelMode').value!=='db';sections.get('export').hidden=is3d;sections.get('three').hidden=!is3d;$('axisSide3d').closest('label').hidden=!is3d;ink3dHint.hidden=!is3d;if(active&&sections.get(active).hidden)select(is3d?'three':'colors')};
 new MutationObserver(sync).observe(panel3d,{attributes:true,attributeFilter:['hidden']});sync();
}
mountLabWorkbench();
$('levelMode').onchange=()=>{cancelDrag();changed()};$('dbFloor').onchange=changed;
initLanguage();syncSelection();
window.addEventListener('lab-language-change',()=>{syncSelection(false);syncZoom(false);updateLevelUI();surface.update()});
syncZoom();if(payload){loadInk();init()}else{
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.type!=='analysis-ready'||samples)return;try{const d=e.data;sourceName=d.name||sourceName;meta.rows=d.rows;meta.duration=d.duration;samples=new Float32Array(d.values);levels=d.levels?new Float32Array(d.levels):null;if(levels&&levels.length!==samples.length)throw Error(t('dataError'));$('levelMode').querySelector('[value=db]').disabled=!levels;rawEncoding=d.encoding==='raw-cqt-v1';peaks=d.peaks?new Uint8Array(d.peaks):null;if(peaks&&peaks.length!==samples.length)throw Error(t('dataError'));if(samples.length!==meta.rows*960)throw Error(t('dataError'));storageKey='musical-detail:'+d.key+':annotations:v1';loadInk();audio.src=URL.createObjectURL(d.audio);$('seek').max=meta.duration;start=0;span=Math.min(10,meta.duration);document.querySelector('h1').textContent=d.name;document.title=d.name+' · MuSpec Lab V0.7';setText($('status'),'ready');syncZoom();resize();requestAnimationFrame(tick);parent.postMessage({type:'viewer-ready'},location.origin)}catch(error){parent.postMessage({type:'viewer-error',message:error.message},location.origin)}});
 new ResizeObserver(()=>parent.postMessage({type:'viewer-height',height:document.body.scrollHeight},location.origin)).observe(document.body);
 parent.postMessage({type:'viewer-listening'},location.origin);
}

