import {drawAnnotations} from './annotation-render.mjs?v=0.7';
import {strokeTypes,hitObject,objectBounds,translateObject} from './annotation-objects.mjs?v=0.7';
// Screen-facing shapes have time/pitch anchors on a constant-intensity plane.
// Camera changes project those anchors; edits never change the CQT samples.
export function createSurfaceAnnotations({getData,project,pointAt,pixel,canvas,redraw}){
 let drag=null;
 const state=()=>getData().annotation;
 const measurement=document.createElement('canvas').getContext('2d');
 const measure=(text,size)=>{const c=measurement;c.font=`${size}px system-ui, sans-serif`;return c.measureText(text).width};
 const visible=a=>a.points.some(p=>{const v=getData().view;return p.t>=v.start&&p.t<=v.start+v.span&&p.m>=v.lo&&p.m<=v.hi});
 const hit=p=>{const items=state().items;for(let i=items.length-1;i>=0;i--)if(visible(items[i])&&hitObject(items[i],p,project,measure))return i;return -1};
 const cancel=()=>{drag=null;redraw()};
 function down(e){
  const s=state();if(s.mode==='pan'||(s.mode==='select'&&e.shiftKey))return false;
  if(!['select','text',...strokeTypes].includes(s.mode))return false;
  const p=pixel(e);canvas.focus({preventScroll:true});s.pause();
  if(s.mode==='select'){
   const index=hit(p);s.select(index);if(index<0){redraw();return true}
   const original=s.items[index],item={...original,points:original.points.map(p=>({...p,h:p.h??project(p).raw}))},h=project(item.points[0]).raw,start=pointAt(p,h,false);
   if(start)drag={mode:'move',startPixel:p,start,h,item,index,before:s.items,moved:false};
  }else{
   if(s.mode==='text'&&!s.style.text){s.emptyText();return true}
   const start=pointAt(p);if(!start){s.miss();return true}
   drag={mode:s.mode,startPixel:p,start,h:start.h,moved:false,before:s.items,item:{type:s.mode,...s.style,points:[start]},end:start};
  }
  if(drag)canvas.setPointerCapture(e.pointerId);redraw();return true;
 }
 function move(e){
  const p=pixel(e),s=state();
  if(!drag){canvas.style.cursor=s.mode==='select'?(hit(p)>=0?'move':'default'):s.mode==='text'?'text':strokeTypes.includes(s.mode)?'crosshair':'grab';return false}
  const d=drag;
  if(e.shiftKey&&['rect','ellipse'].includes(d.mode)){const dx=p.x-d.startPixel.x,dy=p.y-d.startPixel.y,length=Math.max(Math.abs(dx),Math.abs(dy));p.x=d.startPixel.x+Math.sign(dx||1)*length;p.y=d.startPixel.y+Math.sign(dy||1)*length}
  if(Math.hypot(p.x-d.startPixel.x,p.y-d.startPixel.y)>3)d.moved=true;
  if(!d.moved)return true;
  const point=pointAt(p,d.h,false);if(!point)return true;
  if(d.mode==='move'){
   const moved=translateObject(d.item,point.t-d.start.t,point.m-d.start.m,getData().duration);
   d.preview=d.before.map((a,i)=>i===d.index?moved:a);
  }else{
   const v=getData().view;point.t=Math.max(v.start,Math.min(v.start+v.span,point.t));point.m=Math.max(v.lo,Math.min(v.hi,point.m));d.end=point;
   if(d.mode==='highlight')d.item.points.push(point);
  }
  redraw();return true;
 }
 const draft=d=>({...d.item,points:d.mode==='highlight'?d.item.points:[d.start,d.end]});
 function up(e){
  if(!drag)return false;const d=drag;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  const s=state();
  if(d.mode==='move'){if(d.moved&&d.preview)s.commit(d.preview,{before:d.before,selection:d.index})}
  else if(d.moved&&strokeTypes.includes(d.mode)){s.setMode('select');s.commit([...d.before,draft(d)],{before:d.before,selection:d.before.length})}
  else if(!d.moved&&d.mode==='text'){s.setMode('select');s.commit([...d.before,d.item],{before:d.before,selection:d.before.length})}
  redraw();return true;
 }
 function draw(c,selection=true){
  const s=state(),items=drag?.preview||s.items;c.save();c.beginPath();c.rect(0,0,canvas.clientWidth,canvas.clientHeight);c.clip();
  drawAnnotations(c,items.filter(visible),project);
  if(drag?.moved&&strokeTypes.includes(drag.mode))drawAnnotations(c,[draft(drag)],project);
  if(selection&&s.mode==='select'&&items[s.selection]&&visible(items[s.selection])){
   const b=objectBounds(items[s.selection],project,measure);c.strokeStyle='#fff';c.lineWidth=3;c.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);c.strokeStyle='#0071e3';c.lineWidth=1.5;c.setLineDash([5,3]);c.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);
  }
  c.restore();
 }
 return {down,move,up,draw,cancel,get dragging(){return !!drag}};
}
