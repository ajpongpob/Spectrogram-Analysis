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
 const values=new Float32Array(nx*ny),bins=new Float32Array(nx*ny),frames=new Uint32Array(nx*ny);
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
  const ta=clamp(Math.floor((v.start+v.span*x/nx)*60),0,rows-1),tb=clamp(Math.ceil((v.start+v.span*(x+1)/nx)*60),ta+1,rows);
  const ba=clamp(Math.floor((v.lo+(v.hi-v.lo)*y/ny-15.5)*8),0,959),bb=clamp(Math.ceil((v.lo+(v.hi-v.lo)*(y+1)/ny-15.5)*8),ba+1,960);
  let max=0,best=ba,bestFrame=ta;
  for(let t=ta;t<tb;t++)for(let b=ba;b<bb;b++){const n=samples[t*960+b];if(n>max){max=n;best=b;bestFrame=t}}
  values[x*ny+y]=max;bins[x*ny+y]=best;frames[x*ny+y]=bestFrame;
 }
 return {values,bins,frames,nx,ny};
}
// Fit a projected scene while retaining its perspective and data coordinates.
export function fitFrame(points,yaw,pitch,distance,aspect){
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const point of points){const [x,y,depth]=project(point,yaw,pitch,distance,aspect);if(depth<=0)continue;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
 if(!Number.isFinite(minX))return {scale:1,x:0,y:0};
 return {scale:Math.min(1.8/Math.max(.01,maxX-minX),1.76/Math.max(.01,maxY-minY)),x:(minX+maxX)/2,y:(minY+maxY)/2};
}

// Exact inverse projection onto a constant-intensity plane, also used for dragging.
export function unprojectPlane(screen,z,yaw,pitch,distance,aspect){
 const a=yaw*Math.PI/180,b=pitch*Math.PI/180,f=1/Math.tan(Math.PI/8),sx=screen[0]*aspect/f,sy=screen[1]/f;
 const den=Math.cos(b)-sy*Math.sin(b);if(Math.abs(den)<1e-5)return null;
 const v=(sy*distance-z*(Math.sin(b)+sy*Math.cos(b)))/den,depth=distance+Math.sin(b)*v-Math.cos(b)*z;
 if(depth<=.1||!Number.isFinite(depth)||Math.abs(v)>100)return null;
 const u=sx*depth;return [Math.cos(a)*u+Math.sin(a)*v,-Math.sin(a)*u+Math.cos(a)*v,z];
}
// Interpolate the same two triangles per cell that WebGL renders (not bilinear).
export function meshRawAt(mesh,x,y){
 const {nx,ny,values}=mesh,gx=clamp((x+2)/4*nx-.5,0,nx-1),gy=clamp((y+1.5)/3*ny-.5,0,ny-1);
 const ix=Math.min(nx-2,Math.floor(gx)),iy=Math.min(ny-2,Math.floor(gy)),u=gx-ix,v=gy-iy,i=ix*ny+iy;
 const a=clamp(values[i],0,3),b=clamp(values[i+ny],0,3),c=clamp(values[i+1],0,3),d=clamp(values[i+ny+1],0,3);
 return clamp(u+v<=1?a*(1-u-v)+b*u+c*v:d*(u+v-1)+b*(1-v)+c*(1-u),0,3);
}
export function insidePolygon(p,vertices){
 let inside=false;
 for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[i],b=vertices[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
