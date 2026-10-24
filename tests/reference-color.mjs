import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {referenceRGB,referenceTable,peakMask,legacyIntensity} from '../public/reference-color.mjs';
import {displayIntensity,highFrequencyBlend,binFrequency,nearestMidi} from '../src/pitch-axis.mjs';
const table=referenceTable();
assert(table.every(Number.isFinite));
assert.deepEqual(referenceRGB(.6,0),[0,0,0]);
for(let i=0;i<=300;i++){
 const gain=i/100;
 assert.deepEqual(referenceRGB(.2,gain),referenceRGB(.2*gain,1));
}
for(let b=0;b<960;b+=7)for(const raw of [0,.01,.2,.8,2,10])assert.equal(legacyIntensity(raw,b),displayIntensity(raw,highFrequencyBlend(binFrequency(b))));
const colors=new Float32Array(960*4);colors[4*100+3]=2;colors[4*101+3]=2;colors[4*700+3]=3;
const mask=peakMask(colors);assert(mask[100]>0);assert.equal(mask[101],0);assert.equal(mask[700],0);assert.equal(mask[0],0);
if(process.env.YTMS_SOURCE){
 const source=fs.readFileSync(process.env.YTMS_SOURCE,'utf8');
 const start=source.indexOf('class ColorRotation {'),end=source.indexOf('const color_rotation =',start);
 const original=vm.runInNewContext('('+source.slice(start,end).trim()+')');
 const reference=new original();reference.update(20,-3,18);
 let maxError=0;
 for(let i=0;i<3006;i++)maxError=Math.max(maxError,Math.abs(table[i]-reference.table[i]));
 assert(maxError<1e-6);console.log('Upstream ColorRotation maximum absolute error:',maxError);
}
const messages=[];globalThis.self={postMessage:data=>messages.push(data)};
await import('../src/analysis-worker.js');
const rate=44100,left=new Float32Array(rate*6);
for(let i=0;i<left.length;i++){const hz=[391.99543598174927,415.3046975799451,440][Math.floor(i/(rate*2))];left[i]=.2*Math.sin(2*Math.PI*hz*i/rate)}
await self.onmessage({data:{left:left.buffer,right:left.slice().buffer,sampleRate:rate}});
const result=messages.find(m=>m.type==='done');assert(result,JSON.stringify(messages.at(-1)));
assert.equal(result.encoding,'raw-cqt-v1');assert.equal(result.rows,360);
const values=new Float32Array(result.values),peaks=new Uint8Array(result.peaks);
assert.equal(peaks.length,values.length);assert(values.every(Number.isFinite));
for(const [sec,midi] of [[1,67],[3,68],[5,69]]){let best=0;for(let b=1;b<960;b++)if(values[sec*60*960+b]>values[sec*60*960+best])best=b;assert.equal(nearestMidi(binFrequency(best)),midi)}
console.log('Reference color, 301 linear gains, peak mask, legacy mapping and worker G/G#/A passed');
