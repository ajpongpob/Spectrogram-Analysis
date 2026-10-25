import assert from 'node:assert/strict';
import {project,heightOf,meshIndices,meshSamples,pickSurface} from '../public/surface-math.mjs';
const triangle=[[-1,-1,0],[1,-1,.4],[0,1,.8]];
const center=[0,-1/3,.4];
for(const yaw of [0,45,90,180,270,325]){
 const screen=project(center,yaw,55,7,1.5);
 const hit=pickSurface(triangle,[0,1,2],screen,yaw,55,7,1.5);
 assert(hit);hit.forEach((x,i)=>assert(Math.abs(x-center[i])<1e-6));
}
assert.equal(pickSurface(triangle,[0,1,2],[10,10],0,55,7,1.5),null);
console.log('PASS: perspective-correct cursor picking at six camera angles and empty-space rejection');
for(const p of [[-2,-1.5,-.6],[2,1.5,1.4],[0,0,0]])for(const angle of [0,90,180,270]){
 const a=project(p,angle,55,7,1.5),b=project(p,angle+360,55,7,1.5);a.forEach((x,i)=>assert(Math.abs(x-b[i])<1e-12));assert(a.every(Number.isFinite));
}
assert.equal(heightOf(0,1),-.6);assert.equal(heightOf(3,1),1.4);assert.equal(heightOf(6,1),1.4);assert.equal(heightOf(1.5,1),.4);
const idx=meshIndices(160,320);assert.equal(idx.length,159*319*6);assert(idx.every(x=>x<160*320));
const samples=new Float32Array(600*960);samples[300*960+125]=2;
const mesh=meshSamples(samples,600,{start:0,span:10,lo:15.5,hi:135.5});assert.equal(Math.max(...mesh.values),2);assert.equal(mesh.bins[mesh.values.indexOf(2)],125);
assert.equal(Math.max(...meshSamples(samples,600,{start:0,span:2,lo:15.5,hi:135.5}).values),0);
assert.equal(Math.max(...meshSamples(samples,600,{start:4,span:2,lo:60,hi:100}).values),0);
console.log('PASS: 360° projection, fixed linear heights, Uint16 mesh limits, transient preservation and time/pitch cropping');
const {fitFrame}=await import('../public/surface-math.mjs');
for(const aspect of [.8,1.6,2.4])for(const yaw of [0,45,120,270,325]){
 const points=[[-2,-1.5,-.6],[2,1.5,-.6],[0,0,1.4]],fit=fitFrame(points,yaw,55,7,aspect);
 for(const point of points){const p=project(point,yaw,55,7,aspect),screen=[(p[0]-fit.x)*fit.scale,(p[1]-fit.y)*fit.scale];assert(Math.abs(screen[0])<=.900001);assert(Math.abs(screen[1])<=.880001);assert(Math.abs(screen[0]/fit.scale+fit.x-p[0])<1e-10)}
}
console.log('PASS: scene fit across viewport ratios and rotations with reversible screen coordinates');
const {unprojectPlane,meshRawAt}=await import('../public/surface-math.mjs');
let inversions=0;
for(const aspect of [.8,1.7,2.4])for(const yaw of [0,45,90,135,180,225,270,325])for(const pitch of [-85,-40,0,55,85])for(const distance of [4,7,12])for(const z of [-.6,0,1.4,3.4]){
 for(const point of [[-1.7,-1.2,z],[.3,.2,z],[1.8,1.4,z]]){
  const p=project(point,yaw,pitch,distance,aspect),back=unprojectPlane(p,z,yaw,pitch,distance,aspect);
  if(p[2]<=.1){assert.equal(back,null);continue}
  assert(back);back.forEach((n,i)=>assert(Math.abs(n-point[i])<1e-8));inversions++;
 }
}
const layers=[[-1,-1,0],[1,-1,0],[0,1,0],[-1,-1,1],[1,-1,1],[0,1,1]];
assert.equal(pickSurface(layers,[0,1,2,3,4,5],[0,0],0,0,7,1.5)[2],1,'Nearest visible surface wins');
assert.equal(mesh.frames[mesh.values.indexOf(2)],300,'Peak emphasis must use the source time of the aggregate maximum');
const plane={nx:2,ny:2,values:Float32Array.from([0,1,2,6])};
assert(Math.abs(meshRawAt(plane,-.5,-.375)-.75)<1e-8);
assert(Math.abs(meshRawAt(plane,.5,.375)-2.25)<1e-8);
assert.equal(meshRawAt(plane,2,1.5),3,'Interpolation uses clipped vertex heights');
const copy=samples.slice();meshSamples(samples,600,{start:2,span:4,lo:30,hi:80});assert.deepEqual(samples,copy,'3D aggregation cannot mutate CQT');
console.log(`PASS: ${inversions} inverse projections, nearest-depth selection, triangle height interpolation, exact peak source frame, immutable CQT`);
