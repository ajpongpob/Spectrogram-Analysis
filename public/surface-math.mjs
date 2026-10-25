export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
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
