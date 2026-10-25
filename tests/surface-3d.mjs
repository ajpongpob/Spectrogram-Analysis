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
