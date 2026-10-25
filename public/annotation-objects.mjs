const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function validAnnotation(a){
 if(!a||!['rect','line','highlight','text'].includes(a.type)||!/^#[0-9a-f]{6}$/i.test(a.color)||!Array.isArray(a.points)||!a.points.length||!a.points.every(p=>p&&Number.isFinite(p.t)&&Number.isFinite(p.m)))return false;
 if(a.type==='text')return a.points.length===1&&typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=240&&Number.isFinite(a.fontSize)&&a.fontSize>=8&&a.fontSize<=96;
 return Number.isFinite(a.width)&&a.width>0&&a.points.length>=2;
}
export const strokeWidth=a=>a.type==='highlight'&&!a.strokePixels?a.width*6:a.width;
export function objectBounds(a,project,measure){
 const p=a.points.map(project);
 if(a.type==='text'){const lines=a.text.split('\n');return {x:p[0].x,y:p[0].y,w:Math.max(1,...lines.map(line=>measure(line,a.fontSize))),h:lines.length*a.fontSize*1.45}}
 const pad=strokeWidth(a)/2,b=p.reduce((b,v)=>({left:Math.min(b.left,v.x),right:Math.max(b.right,v.x),top:Math.min(b.top,v.y),bottom:Math.max(b.bottom,v.y)}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
 return {x:b.left-pad,y:b.top-pad,w:b.right-b.left+pad*2,h:b.bottom-b.top+pad*2};
}
function segmentDistance(p,a,b){const x=b.x-a.x,y=b.y-a.y,t=clamp(((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1),0,1);return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y)}
export function hitObject(a,point,project,measure){
 const bounds=objectBounds(a,project,measure),tolerance=6;
 if(point.x<bounds.x-tolerance||point.x>bounds.x+bounds.w+tolerance||point.y<bounds.y-tolerance||point.y>bounds.y+bounds.h+tolerance)return false;
 if(a.type==='text'||a.type==='rect')return true;
 const p=a.points.map(project);return p.slice(1).some((next,i)=>segmentDistance(point,p[i],next)<=Math.max(tolerance,strokeWidth(a)/2));
}
export function translateObject(a,dt,dm,duration){
 const b=a.points.reduce((b,p)=>({minT:Math.min(b.minT,p.t),maxT:Math.max(b.maxT,p.t),minM:Math.min(b.minM,p.m),maxM:Math.max(b.maxM,p.m)}),{minT:Infinity,maxT:-Infinity,minM:Infinity,maxM:-Infinity});
 dt=clamp(dt,-b.minT,duration-b.maxT);dm=clamp(dm,15.5-b.minM,135.5-b.maxM);
 return {...a,points:a.points.map(p=>({t:p.t+dt,m:p.m+dm}))};
}
