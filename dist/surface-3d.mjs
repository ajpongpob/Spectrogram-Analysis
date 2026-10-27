import {dbUnit,dbRGB} from './signal-level.mjs?v=db-1';
import {t,setText} from './i18n.mjs?v=stereo-1';
import {clamp,project,heightOf,meshIndices,meshSamples,pickSurface,fitFrame,unprojectPlane,meshRawAt,insidePolygon} from './surface-math.mjs?v=db-1';
import {createSurfaceAnnotations} from './surface-annotations.mjs?v=db-1';
import {referenceRGB,legacyIntensity} from './reference-color.mjs';

export function createSurface(getData,plot,options={}){
 const toolbar=document.createElement('nav');toolbar.className='view-tabs';toolbar.setAttribute('role','tablist');toolbar.dataset.i18nAria='viewModes';
 toolbar.innerHTML='<button id="mode2d" role="tab" aria-selected="true" aria-controls="plot" data-i18n="mode2d">2D</button><button id="mode3d" role="tab" aria-selected="false" aria-controls="panel3d" tabindex="-1" data-i18n="mode3d">3D</button><span id="modeHint" data-i18n="gestureHint"></span>';
 if(options.prefix){toolbar.hidden=true;plot.parentElement.prepend(toolbar)}else plot.closest('main').prepend(toolbar);
 const wrap=document.createElement('section');wrap.hidden=true;
 wrap.innerHTML=`<div class="tools"><label><span data-i18n="axisSide"></span><select id="axisSide3d"><option value="right" data-i18n="rightSide"></option><option value="left" data-i18n="leftSide"></option></select></label><label><span data-i18n="yaw"></span><input id="yaw3d" type="range" min="0" max="360" step="1" value="325"><output id="yawOut">325°</output></label><label><span data-i18n="tilt"></span><input id="pitch3d" type="range" min="-85" max="85" value="55"><output id="pitchAngleOut">55°</output></label><label><span data-i18n="height"></span><input id="height3d" type="range" min="0" max="2" step="0.05" value="1"><output id="heightOut">1.00×</output></label><button id="reset3d" data-i18n="reset3d"></button><button id="top3d" data-i18n="top3d"></button><button id="png3d" data-i18n="png3d"></button></div><p class="muted" data-i18n="hint3d"></p><div style="position:relative;height:600px;background:#090911;border:1px solid #e5e5e9;border-radius:8px;overflow:hidden"><canvas id="surface3d" data-i18n-aria="surfaceLabel" tabindex="0" style="width:100%;height:100%;touch-action:none;display:block"></canvas><canvas id="labels3d" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></canvas></div><p id="status3d" role="status" class="muted"></p>`;
 wrap.id='panel3d';wrap.setAttribute('role','tabpanel');wrap.setAttribute('aria-labelledby','mode3d');
 plot.setAttribute('role','tabpanel');plot.setAttribute('aria-labelledby','mode2d');
 plot.before(wrap);const nodes=new Map([wrap,...toolbar.querySelectorAll('[id]'),...wrap.querySelectorAll('[id]')].map(el=>[el.id,el]));const $=id=>nodes.get(id),button=$('mode3d'),button2d=$('mode2d'),canvas=$('surface3d'),labels=$('labels3d');if(options.prefix){for(const [id,el] of nodes)el.id=options.prefix+id;wrap.removeAttribute('aria-labelledby');plot.removeAttribute('aria-labelledby');wrap.querySelector('.tools').hidden=true;}
 const only2d=options.prefix?[]:[document.getElementById('capture').closest('.tools'),document.getElementById('boxZoom'),document.getElementById('readout')].filter(Boolean);
 // Explicitly identify the 2D gesture hint, without depending on sibling order.
 if(!options.prefix)only2d.push(document.getElementById('gestureHint'));
 canvas.style.cursor='grab';
 let pickPoints=[],pickIndices=[],framing={scale:1,x:0,y:0},frameKey='',geometryVersion=0,viewZoom=1;
 function screenProject(point){const p=project(point,yaw,pitch,cameraDistance(),canvas.clientWidth/canvas.clientHeight);return [(p[0]-framing.x)*framing.scale,(p[1]-framing.y)*framing.scale,p[2]]}
 function fitScene(){if(drag&&!drag.orbit)return;const data=getData(),shared=data.frameHeight?(data.style.levelMode==='db'?3:data.frameHeight):null,aspect=canvas.clientWidth/canvas.clientHeight,key=[yaw,pitch,height,aspect,geometryVersion,viewZoom,shared].join(':');if(key===frameKey)return;frameKey=key;const markers=[];for(const x of [-2.45,2.45])for(const y of [-1.9,1.7])markers.push([x,y,-.6]);markers.push([-2.15,-1.5,heightOf(3,height)]);if(shared)for(const x of [-2.45,2.45])for(const y of [-1.9,1.7])markers.push([x,y,heightOf(shared,height)]);framing=fitFrame(shared?markers:[...pickPoints,...markers],yaw,pitch,cameraDistance(),aspect);framing.scale*=viewZoom}
 function cameraDistance(){return distance*Math.max(1,1.15/(canvas.clientWidth/canvas.clientHeight))}
 function hit(e){if(!pickPoints.length)return null;const r=canvas.getBoundingClientRect();return pickSurface(pickPoints,pickIndices,[((e.clientX-r.left)/r.width*2-1)/framing.scale+framing.x,(1-(e.clientY-r.top)/r.height*2)/framing.scale+framing.y],yaw,pitch,cameraDistance(),r.width/r.height)}
 let keys=[];
 let enabled=false,gl,program,buffer,indexBuffer,lineBuffer,indexCount=0,lineCount=0,yaw=325,pitch=55,distance=7,height=1,mesh,displayMesh,v,signature='',pending=0,drag=null,lost=false;
 const pixel=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
 const ndc=p=>[(p.x/canvas.clientWidth*2-1)/framing.scale+framing.x,(1-p.y/canvas.clientHeight*2)/framing.scale+framing.y];
 function annotationProject(point){
  const x=-2+4*(point.t-v.start)/v.span,y=-1.5+3*(point.m-v.lo)/(v.hi-v.lo),raw=point.h!==undefined&&(point.unit||'cqt')===getData().style.levelMode&&(point.unit!=='db'||point.dbFloor===getData().style.dbFloor)?point.h:meshRawAt(displayMesh,x,y),p=screenProject([x,y,heightOf(raw,height)]);
  return {x:(p[0]+1)*canvas.clientWidth/2,y:(1-p[1])*canvas.clientHeight/2,raw};
 }
 function annotationPoint(pixel,raw,limited=true){
  const screen=ndc(pixel),aspect=canvas.clientWidth/canvas.clientHeight;
  let point=raw===undefined?pickSurface(pickPoints,pickIndices,screen,yaw,pitch,cameraDistance(),aspect):null;
  if(point)raw=meshRawAt(displayMesh,point[0],point[1]);
  else {raw??=0;point=unprojectPlane(screen,heightOf(raw,height),yaw,pitch,cameraDistance(),aspect)}
  if(!point||limited&&(Math.abs(point[0])>2||Math.abs(point[1])>1.5))return null;
  return {t:v.start+(point[0]+2)/4*v.span,m:v.lo+(point[1]+1.5)/3*(v.hi-v.lo),h:raw,unit:getData().style.levelMode,dbFloor:getData().style.dbFloor};
 }
 const ink=createSurfaceAnnotations({getData,project:annotationProject,pointAt:annotationPoint,pixel,canvas,redraw:()=>schedule()});
 const vertex=`attribute vec3 position;attribute vec3 color;varying vec3 tint;uniform vec4 camera;uniform vec3 framing;void main(){float a=radians(camera.x),b=radians(camera.y);float x=cos(a)*position.x-sin(a)*position.y;float y=sin(a)*position.x+cos(a)*position.y;float h=cos(b)*y+sin(b)*position.z;float d=-sin(b)*y+cos(b)*position.z-camera.z;float f=2.41421356237;gl_Position=vec4(f*x/camera.w,f*h,-1.002002*d-.2002002,-d);gl_Position.xy=(gl_Position.xy/gl_Position.w-framing.yz)*framing.x*gl_Position.w;tint=color;}`;
 const fragment='precision mediump float;varying vec3 tint;void main(){gl_FragColor=vec4(tint,1.);}';
 function init(){
  gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error(t('noWebGL'));
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  buffer=gl.createBuffer();indexBuffer=gl.createBuffer();lineBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);
 }
 function controls(){for(const [id,value] of [['yaw3d',yaw],['pitch3d',pitch],['height3d',height]])$(id).value=value;$('yawOut').value=Math.round(yaw)+'°';$('pitchAngleOut').value=Math.round(pitch)+'°';$('heightOut').value=height.toFixed(2)+'×';options.onCamera?.(cameraState())}
 function rebuild(){
  const d=getData();if(!d)return;v=d.view;
  const db=d.style.levelMode==='db',key=JSON.stringify([v,d.rows,db,d.sourceKey]);if(key!==signature){mesh=meshSamples(db?d.levels:d.samples,d.rows,v);signature=key}
  displayMesh=db?{...mesh,values:Float32Array.from(mesh.values,a=>3*dbUnit(a,d.style.dbFloor))}:mesh;
  const {nx,ny,values,bins}=mesh,verts=new Float32Array(nx*ny*6),pal=d.palettes[d.style.palette];let clipped=0;
  for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
   const i=x*ny+y,raw=values[i],b=bins[i];let col;
   if(raw>(db?1:3))clipped++;
   if(db)col=dbRGB(raw,d.style.palette==='reference'?null:pal,referenceRGB,d.style.dbFloor);
   else if(d.style.palette==='reference'){
    col=referenceRGB(raw,d.style.gain);
    if(d.style.peak&&d.peaks){const t=mesh.frames[i],a=d.peaks[t*960+b]/255;col=col.map((c,k)=>c*(1-[.6,.8,.2][k]*a))}
   }else{const val=clamp(legacyIntensity(raw,b)*d.style.gain,0,1)*4,j=Math.min(3,Math.floor(val)),f=val-j;col=pal[j].map((c,k)=>c*(1-f)+pal[j+1][k]*f)}
   verts.set([-2+4*(x+.5)/nx,-1.5+3*(y+.5)/ny,heightOf(displayMesh.values[i],height),...col.map(c=>c/255)],i*6);
  }
  geometryVersion++;pickPoints=Array.from({length:nx*ny},(_,i)=>Array.from(verts.subarray(i*6,i*6+3)));
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW);const indices=meshIndices(nx,ny);pickIndices=indices;indexCount=indices.length;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const lines=[],gridColor=d.style.palette==='gray'?[.34,.38,.45]:[.70,.74,.82];function line(a,b){lines.push(...a,...gridColor,...b,...gridColor)}
  if(d.style.timeGrid)for(let i=0;i<=4;i++)line([-2+i,-1.5,-.605],[-2+i,1.5,-.605]);if(d.style.noteGrid)for(let n=Math.ceil(v.lo);n<=v.hi;n++){const y=-1.5+3*(n-v.lo)/(v.hi-v.lo);line([-2,y,-.605],[2,y,-.605])}line([-2,-1.5,-.6],[-2,-1.5,heightOf(3,height)]);
  lineCount=lines.length/6;gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(lines),gl.STATIC_DRAW);
  setText($('status3d'),db?'status3dDb':'status3d',{start:v.start.toFixed(2),end:(v.start+v.span).toFixed(2),nx,ny,clipped,floor:d.style.dbFloor});
 }
 function bind(b){gl.bindBuffer(gl.ARRAY_BUFFER,b);for(const [name,offset] of [['position',0],['color',12]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset)}}
 function render(includeSelection=true){if(!enabled||!gl||lost||!v)return;fitScene();const w=Math.max(1,canvas.clientWidth),h=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio),fitDistance=distance*Math.max(1,1.15/(w/h));canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);labels.width=canvas.width;labels.height=canvas.height;gl.viewport(0,0,canvas.width,canvas.height);const mono=getData()?.style.palette==='gray';canvas.parentElement.style.background=mono?'#ffffff':'#090911';gl.clearColor(...(mono?[1,1,1,1]:[.035,.035,.065,1]));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniform4f(gl.getUniformLocation(program,'camera'),yaw,pitch,fitDistance,w/h);gl.uniform3f(gl.getUniformLocation(program,'framing'),framing.scale,framing.x,framing.y);bind(buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);// Grid lines are an x-ray overlay: draw them through the surface, then restore depth testing.
  gl.disable(gl.DEPTH_TEST);bind(lineBuffer);gl.drawArrays(gl.LINES,0,lineCount);gl.enable(gl.DEPTH_TEST);
  const c=labels.getContext('2d');c.scale(dpr,dpr);c.font='12px system-ui';c.fillStyle=mono?'#1d1d1f':'#e7e0f4';c.textAlign='center';
  const occupied=[];
  const label=(pos,text,avoidOverlap=false)=>{
   const p=screenProject(pos);if(p[2]<=0)return;const x=(p[0]+1)*w/2,y=(1-p[1])*h/2,width=c.measureText(text).width;
   const left=x-(c.textAlign==='center'?width/2:c.textAlign==='right'?width:0),box={left:left-4,right:left+width+4,top:y-13,bottom:y+4};
   if(avoidOverlap&&(box.left<4||box.right>w-4||box.top<4||box.bottom>h-4||occupied.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top)))return;
   occupied.push(box);c.strokeStyle=mono?'#ffffff':'#090911';c.lineWidth=4;c.strokeText(text,x,y);c.fillText(text,x,y);
  };
  const data=getData();
  for(let i=0;i<=4;i++)label([-2+i,-1.65,-.6],data.formatTime(v.start+v.span*i/4,1,data.style.clock));
  const current=data.audio.currentTime;
  if(current>=v.start&&current<=v.start+v.span){const x=-2+4*(current-v.start)/v.span;const pts=[screenProject([x,-1.5,-.6]),screenProject([x,1.5,-.6])];c.strokeStyle=mono?'#1d1d1f':'#fff';c.lineWidth=2;c.beginPath();pts.forEach((p,i)=>{const px=(p[0]+1)*w/2,py=(1-p[1])*h/2;if(i)c.lineTo(px,py);else c.moveTo(px,py)});c.stroke();label([x,-1.85,-.6],'▶ '+data.formatTime(current,2,data.style.clock))}
  for(let i=0;i<=3;i++)label([-2.15,-1.5,heightOf(i,height)],data.style.levelMode==='db'?String(data.style.dbFloor+i/3*-data.style.dbFloor):String(i));
  // The keyboard follows the chosen projected edge, so it stays aligned with pitch.
  const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  const rightEdge=screenProject([2,0,-.6])[0]>=screenProject([-2,0,-.6])[0]?1:-1,side=$('axisSide3d').value==='right'?rightEdge:-rightEdge;
  const yForNote=n=>-1.5+3*(n-v.lo)/(v.hi-v.lo),keysOuter=2.20*side,keysInner=2.04*side;
  keys=[];const density=hiDensity();
  c.font='11px system-ui';c.textAlign=$('axisSide3d').value==='right'?'left':'right';
  for(let n=Math.ceil(v.lo-.5);n<=Math.floor(v.hi+.5);n++){
   const low=yForNote(Math.max(v.lo,n-.5)),high=yForNote(Math.min(v.hi,n+.5));if(high<=low)continue;
   const corners=[[keysInner,low,-.6],[keysOuter,low,-.6],[keysOuter,high,-.6],[keysInner,high,-.6]].map(screenProject);
   if(data.style.piano){keys.push({midi:n,corners:corners.map(p=>({x:(p[0]+1)*w/2,y:(1-p[1])*h/2}))});
   c.beginPath();corners.forEach((p,i)=>{const x=(p[0]+1)*w/2,y=(1-p[1])*h/2;i?c.lineTo(x,y):c.moveTo(x,y)});c.closePath();
   const black=[1,3,6,8,10].includes((n%12+12)%12);c.fillStyle=black?'#252832':'#f4f4f6';c.fill();c.strokeStyle='#737782';c.lineWidth=.65;c.stroke();}
   const black=[1,3,6,8,10].includes((n%12+12)%12);
   if(n<v.lo||n>v.hi||black&&density<13)continue;
   const anchor=[(data.style.piano?2.27:2.06)*side,yForNote(n),-.6];
   c.fillStyle=mono?'#1d1d1f':'#e7e0f4';label(anchor,data.style.axis.startsWith('hz')?(440*2**((n-69)/12)).toFixed(n<36?1:0)+' Hz':names[(n%12+12)%12]+(Math.floor(n/12)-1),true);
  }
  function hiDensity(){const a=screenProject([keysOuter,-1.5,-.6]),b=screenProject([keysOuter,1.5,-.6]);return Math.hypot((a[0]-b[0])*w/2,(a[1]-b[1])*h/2)/(v.hi-v.lo)}
  c.fillStyle=mono?'#1d1d1f':'#e7e0f4';c.font='12px system-ui';
  c.textAlign='left';c.font='10px system-ui';c.fillText(t(data.style.levelMode==='db'?'axes3dDb':'axes3d')+' · '+t(data.style.levelMode==='db'?'height3dDbNote':'height3dNote',{yaw:Math.round(yaw)}),15,h-14);
  ink.draw(c,includeSelection);
 }
 let needsBuild=false;
 function schedule(rebuildMesh=false){needsBuild=needsBuild||rebuildMesh;cancelAnimationFrame(pending);pending=requestAnimationFrame(()=>{try{if(!enabled||lost)return;if(needsBuild){rebuild();needsBuild=false}render()}catch(e){setText($('status3d'),'errorDetail',{message:e.message})}})}
 function setMode(next){
  if(!getData())return;
  ink.cancel();if(!options.prefix)getData().annotation.setMode('pan');enabled=next;wrap.hidden=!enabled;plot.style.display=enabled?'none':'block';
  only2d.forEach(el=>el.hidden=enabled);
  button.setAttribute('aria-selected',String(enabled));button2d.setAttribute('aria-selected',String(!enabled));button.tabIndex=enabled?0:-1;button2d.tabIndex=enabled?-1:0;
  setText($('modeHint'),enabled?'hint3d':'gestureHint');
  if(enabled){try{if(!gl)init();schedule(true)}catch(e){setText($('status3d'),'errorDetail',{message:e.message})}}
 }
 button.onclick=()=>setMode(true);button2d.onclick=()=>setMode(false);
 toolbar.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='ArrowRight'||e.key==='End';setMode(next);(next?button:button2d).focus()};
 for(const id of ['yaw3d','pitch3d','height3d'])$(id).oninput=()=>{yaw=+$('yaw3d').value;pitch=+$('pitch3d').value;height=+$('height3d').value;controls();schedule(id==='height3d')};
 $('axisSide3d').onchange=()=>{controls();schedule()};
 $('reset3d').onclick=()=>{yaw=325;pitch=55;distance=7;viewZoom=1;height=1;controls();schedule(true)};$('top3d').onclick=()=>{yaw=0;pitch=0;controls();schedule()};
 canvas.onpointerdown=e=>{if(e.button!==0||!mesh||lost)return;const key=keys.find(k=>insidePolygon(pixel(e),k.corners));if(key){getData().playReference(key.midi);return}if(ink.down(e))return;canvas.focus();const p=hit(e);drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,orbit:e.shiftKey,moved:false,point:p,view:{...getData().view}};canvas.setPointerCapture(e.pointerId)};
 canvas.onpointermove=e=>{
  if(!drag&&!ink.dragging&&keys.some(k=>insidePolygon(pixel(e),k.corners))){canvas.style.cursor='pointer';return}
  if(ink.move(e))return;
  if(!drag)return;const d=drag,dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>3)d.moved=true;if(!d.moved)return;
  if(d.orbit){yaw=(yaw+(e.clientX-d.lastX)*.5+360)%360;pitch=clamp(pitch+(e.clientY-d.lastY)*.4,-85,85);controls();schedule()}
  else if(d.point){
   const point=unprojectPlane(ndc(pixel(e)),d.point[2],yaw,pitch,cameraDistance(),canvas.clientWidth/canvas.clientHeight);
   if(point)getData().pan(d.view,-(point[0]-d.point[0])/4*d.view.span,-(point[1]-d.point[1])/3*(d.view.hi-d.view.lo));
  }
  d.lastX=e.clientX;d.lastY=e.clientY;
 };
 canvas.onpointerup=e=>{if(ink.up(e))return;if(!drag)return;const d=drag;drag=null;canvas.releasePointerCapture(e.pointerId);if(!d.moved&&!d.orbit&&d.point)getData().seekAt(d.view.start+(d.point[0]+2)/4*d.view.span);schedule()};
 canvas.onpointercancel=()=>{drag=null;ink.cancel()};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){drag=null;ink.cancel()}});
 canvas.addEventListener('wheel',e=>{e.preventDefault();if(drag||ink.dragging)return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1),f=Math.exp(clamp(delta,-300,300)*.002),d=getData();if(e.altKey){viewZoom=clamp(viewZoom/f,.5,3);controls();schedule()}else{const p=hit(e),v=d.view;if(e.ctrlKey)d.zoomPitch(f,p?v.lo+(p[1]+1.5)/3*(v.hi-v.lo):undefined);else d.zoomTime(f,p?v.start+(p[0]+2)/4*v.span:undefined)}},{passive:false});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;drag=null;ink.cancel();setText($('status3d'),'webglLost')});canvas.addEventListener('webglcontextrestored',()=>{lost=false;gl=null;init();schedule(true)});
 new ResizeObserver(()=>{drag=null;ink.cancel();schedule()}).observe(canvas);
 $('png3d').onclick=()=>{if(needsBuild){rebuild();needsBuild=false}render(false);const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const c=out.getContext('2d');c.drawImage(canvas,0,0);c.drawImage(labels,0,0);out.toBlob(blob=>{if(!blob)return;const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='spectrogram-3d.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)},'image/png');schedule()};
 let lastFrame='';
 function cameraState(){return {yaw,pitch,height,distance,viewZoom,axisSide:$('axisSide3d').value}}
 return {panel:wrap,canvas,labels,camera:cameraState,setCamera(state){if(JSON.stringify(cameraState())===JSON.stringify(state))return;({yaw,pitch,height,distance,viewZoom}=state);$('axisSide3d').value=state.axisSide;controls();schedule(true)},setEnabled:setMode,anchorObject:a=>({...a,points:a.points.map(p=>({...p,h:annotationProject(p).raw,unit:getData().style.levelMode,dbFloor:getData().style.dbFloor}))}),inspect:()=>({yaw,pitch,height,distance:cameraDistance(),framing:{...framing},view:{...v},nx:mesh?.nx,ny:mesh?.ny,levelMode:getData()?.style.levelMode,dbFloor:getData()?.style.dbFloor}),pasteOffset:point=>{const p=annotationProject(point);if(p.x>=0&&p.x<canvas.clientWidth-36&&p.y>=0&&p.y<canvas.clientHeight-36){const next=annotationPoint({x:p.x+18,y:p.y+18},p.raw,false);if(next)return {dt:next.t-point.t,dm:next.m-point.m}}return {dt:v.start+v.span*.5-point.t,dm:(v.lo+v.hi)/2-point.m}},repaint:()=>schedule(),cancelAnnotation:()=>ink.cancel(),get annotating(){return ink.dragging},update:()=>{ink.cancel();schedule(true)},frame:()=>{if(!enabled)return;const d=getData();if(!d)return;const key=[Math.floor(d.audio.currentTime*30),d.audio.paused,d.follow.checked,d.style.clock].join(':');if(key===lastFrame)return;lastFrame=key;schedule()}};
}
