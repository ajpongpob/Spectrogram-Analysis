export const strokeTypes=['rect','line','highlight','arrow','doubleArrow','ellipse','triangle'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function validAnnotation(a){
 if(!a||![...strokeTypes,'text'].includes(a.type)||!/^#[0-9a-f]{6}$/i.test(a.color)||!Array.isArray(a.points)||!a.points.length||!a.points.every(p=>p&&Number.isFinite(p.t)&&Number.isFinite(p.m)))return false;
 if(a.type==='text')return a.points.length===1&&typeof a.text==='string'&&a.text.trim().length>0&&a.text.length<=240&&Number.isFinite(a.fontSize)&&a.fontSize>=8&&a.fontSize<=96;
 return Number.isFinite(a.width)&&a.width>0&&a.points.length>=2;
}
export const strokeWidth=a=>a.type==='highlight'&&!a.strokePixels?a.width*6:a.width;
export function arrowGeometry(a,project){
 const [start,end]=a.points.map(project),dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
 if(length<.001)return {shaft:[start,end],heads:[]};
 const ux=dx/length,uy=dy/length,headLength=Math.min(Math.max(10,strokeWidth(a)*3.5),length*(a.type==='doubleArrow'?.28:.45)),half=headLength*.48;
 const head=(tip,direction)=>{const base={x:tip.x-ux*headLength*direction,y:tip.y-uy*headLength*direction};return [tip,{x:base.x-uy*half,y:base.y+ux*half},{x:base.x+uy*half,y:base.y-ux*half}]};
 const heads=[head(end,1)];if(a.type==='doubleArrow')heads.push(head(start,-1));
 return {shaft:[a.type==='doubleArrow'?{x:start.x+ux*headLength*.8,y:start.y+uy*headLength*.8}:start,{x:end.x-ux*headLength*.8,y:end.y-uy*headLength*.8}],heads};
}
export function trianglePoints(a,project){const [p,q]=a.points.map(project),left=Math.min(p.x,q.x),right=Math.max(p.x,q.x),top=Math.min(p.y,q.y),bottom=Math.max(p.y,q.y);return [{x:(left+right)/2,y:top},{x:right,y:bottom},{x:left,y:bottom}]}
export function objectBounds(a,project,measure){
 let p=a.points.map(project);
 if(['arrow','doubleArrow'].includes(a.type)){const geometry=arrowGeometry(a,project);p=[...geometry.shaft,...geometry.heads.flat()]}
 if(a.type==='text'){const lines=a.text.split('\n');return {x:p[0].x,y:p[0].y,w:Math.max(1,...lines.map(line=>measure(line,a.fontSize))),h:lines.length*a.fontSize*1.45}}
 const pad=strokeWidth(a)/2,b=p.reduce((b,v)=>({left:Math.min(b.left,v.x),right:Math.max(b.right,v.x),top:Math.min(b.top,v.y),bottom:Math.max(b.bottom,v.y)}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
 return {x:b.left-pad,y:b.top-pad,w:b.right-b.left+pad*2,h:b.bottom-b.top+pad*2};
}
function segmentDistance(p,a,b){const x=b.x-a.x,y=b.y-a.y,t=clamp(((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1),0,1);return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y)}
function hitPolygon(point,vertices,tolerance){
 let inside=false;
 for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[i],b=vertices[j];if(segmentDistance(point,a,b)<=tolerance)return true;
  if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
export function hitObject(a,point,project,measure){
 const bounds=objectBounds(a,project,measure),tolerance=Math.max(6,a.type==='text'?0:strokeWidth(a)/2);
 if(point.x<bounds.x-tolerance||point.x>bounds.x+bounds.w+tolerance||point.y<bounds.y-tolerance||point.y>bounds.y+bounds.h+tolerance)return false;
 if(a.type==='text'||a.type==='rect')return true;
 const p=a.points.map(project);
 if(a.type==='ellipse'){
  const rx=Math.abs(p[1].x-p[0].x)/2,ry=Math.abs(p[1].y-p[0].y)/2,cx=(p[0].x+p[1].x)/2,cy=(p[0].y+p[1].y)/2;
  if(rx<.5||ry<.5)return segmentDistance(point,p[0],p[1])<=tolerance;
  return ((point.x-cx)/(rx+tolerance))**2+((point.y-cy)/(ry+tolerance))**2<=1;
 }
 if(a.type==='triangle')return hitPolygon(point,trianglePoints(a,project),tolerance);
 if(['arrow','doubleArrow'].includes(a.type)){const {shaft,heads}=arrowGeometry(a,project);return segmentDistance(point,...shaft)<=tolerance||heads.some(head=>hitPolygon(point,head,tolerance))}
 return p.slice(1).some((next,i)=>segmentDistance(point,p[i],next)<=tolerance);
}
export function translateObject(a,dt,dm,duration){
 const b=a.points.reduce((b,p)=>({minT:Math.min(b.minT,p.t),maxT:Math.max(b.maxT,p.t),minM:Math.min(b.minM,p.m),maxM:Math.max(b.maxM,p.m)}),{minT:Infinity,maxT:-Infinity,minM:Infinity,maxM:-Infinity});
 dt=clamp(dt,-b.minT,duration-b.maxT);dm=clamp(dm,15.5-b.minM,135.5-b.maxM);
 return {...a,points:a.points.map(p=>({t:p.t+dt,m:p.m+dm}))};
}
