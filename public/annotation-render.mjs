import {strokeWidth,arrowGeometry,trianglePoints} from './annotation-objects.mjs?v=db-1';
// Both views and PNG exports use the same object renderer.
export function drawAnnotations(g,list,project){
 for(const a of list){
  g.save();const p=a.points.map(project);
  if(a.type==='text'){
   g.fillStyle=a.color;g.font=`${a.fontSize}px system-ui, sans-serif`;g.textAlign='left';g.textBaseline='top';
   a.text.split('\n').forEach((line,i)=>g.fillText(line,p[0].x,p[0].y+i*a.fontSize*1.45));
  }else{
   // Older saved highlights used a sixfold width multiplier.
   g.strokeStyle=a.color;g.lineWidth=strokeWidth(a);
   g.lineCap='round';g.lineJoin='round';g.globalAlpha=a.type==='highlight'?.3:1;g.beginPath();
   if(['arrow','doubleArrow'].includes(a.type)){
    const {shaft,heads}=arrowGeometry(a,project);
    g.moveTo(shaft[0].x,shaft[0].y);g.lineTo(shaft[1].x,shaft[1].y);g.stroke();g.fillStyle=a.color;
    for(const head of heads){g.beginPath();g.moveTo(head[0].x,head[0].y);for(const point of head.slice(1))g.lineTo(point.x,point.y);g.closePath();g.fill()}
   }else{
    if(a.type==='rect')g.rect(p[0].x,p[0].y,p[1].x-p[0].x,p[1].y-p[0].y);
    else if(a.type==='ellipse')g.ellipse((p[0].x+p[1].x)/2,(p[0].y+p[1].y)/2,Math.abs(p[1].x-p[0].x)/2,Math.abs(p[1].y-p[0].y)/2,0,0,Math.PI*2);
    else if(a.type==='triangle'){const vertices=trianglePoints(a,project);g.moveTo(vertices[0].x,vertices[0].y);for(const point of vertices.slice(1))g.lineTo(point.x,point.y);g.closePath()}
    else{g.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)g.lineTo(p[i].x,p[i].y)}g.stroke();
   }
  }
  g.restore();
 }
}
