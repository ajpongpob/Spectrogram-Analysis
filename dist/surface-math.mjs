export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Pick the front-most rendered triangle, with perspective-correct coordinates.
export function pickSurface(points,indices,screen,yaw,pitch,distance,aspect){
 const projected=points.map(p=>project(p,yaw,pitch,distance,aspect));
 let best=null,depth=Infinity;
 for(let k=0;k<indices.length;k+=3){
  const ids=[indices[k],indices[k+1],indices[k+2]], [a,b,c]=ids.map(i=>projected[i]);
  if(a[2]<=0||b[2]<=0||c[2]<=0)continue;
  const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(den)<1e-12)continue;
  const u=((b[1]-c[1])*(screen[0]-c[0])+(c[0]-b[0])*(screen[1]-c[1]))/den;
  const v=((c[1]-a[1])*(screen[0]-c[0])+(a[0]-c[0])*(screen[1]-c[1]))/den,w=1-u-v;
  if(Math.min(u,v,w)<-1e-7)continue;
  const weights=[u/a[2],v/b[2],w/c[2]],sum=weights.reduce((x,y)=>x+y,0),z=1/sum;
  if(z<depth){depth=z;best=[0,1,2].map(axis=>ids.reduce((n,id,i)=>n+points[id][axis]*weights[i]/sum,0))}
 }
 return best;
}
export function project([x,y,z],yaw,pitch,distance,aspect){
 const a=yaw*Math.PI/180,b=pitch*Math.PI/180;
 const u=Math.cos(a)*x-Math.sin(a)*y,v=Math.sin(a)*x+Math.cos(a)*y;
 const h=Math.cos(b)*v+Math.sin(b)*z,d=-Math.sin(b)*v+Math.cos(b)*z-distance;
 const f=1/Math.tan(Math.PI/8);
 return [f*u/aspect/-d,f*h/-d,-d];
}
// Fixed linear height reference across all windows; no per-window normalization.
export const heightOf=(raw,scale)=>clamp(raw,0,3)/3*2*scale-.6;
export function meshIndices(nx,ny){
 const a=new Uint16Array((nx-1)*(ny-1)*6);let k=0;
 for(let x=0;x<nx-1;x++)for(let y=0;y<ny-1;y++){
  const i=x*ny+y;a.set([i,i+ny,i+1,i+1,i+ny,i+ny+1],k);k+=6;
 }
 return a;
}
// Maximum aggregation preserves short/narrow events in the limited preview mesh.
export function meshSamples(samples,rows,v,nx=160,ny=320){
 const values=new Float32Array(nx*ny),bins=new Float32Array(nx*ny);
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
  const ta=clamp(Math.floor((v.start+v.span*x/nx)*60),0,rows-1),tb=clamp(Math.ceil((v.start+v.span*(x+1)/nx)*60),ta+1,rows);
  const ba=clamp(Math.floor((v.lo+(v.hi-v.lo)*y/ny-15.5)*8),0,959),bb=clamp(Math.ceil((v.lo+(v.hi-v.lo)*(y+1)/ny-15.5)*8),ba+1,960);
  let max=0,best=ba;
  for(let t=ta;t<tb;t++)for(let b=ba;b<bb;b++){const n=samples[t*960+b];if(n>max){max=n;best=b}}
  values[x*ny+y]=max;bins[x*ny+y]=best;
 }
 return {values,bins,nx,ny};
}
