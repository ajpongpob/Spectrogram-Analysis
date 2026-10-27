import assert from 'node:assert/strict';
import {binHz,frameAt,slice,findPeaks,noteLabel,sliceCSV} from '../public/spectrum-math.mjs';
const rows=360, values=new Float32Array(rows*960),levels=new Float32Array(rows*960);
for(let frame=0;frame<rows;frame++){const bin=[332,428,524][Math.floor(frame/120)];values[frame*960+bin]=1.75;levels[frame*960+bin]=.5;}
const data={rows,values,levels},before=values.slice(),beforeLevels=levels.slice();
for(const [time,frame,bin,note] of [[1,60,332,'A3'],[3,180,428,'A4'],[5,300,524,'A5']]){
 const raw=slice(data,time,'cqt'),db=slice(data,time,'db');assert.equal(raw.frame,frame);assert.equal(raw.time,time);assert.equal(raw.values[bin],1.75);assert(Math.abs(db.values[bin]+6.020599913)<1e-8);assert.equal(noteLabel(binHz(bin)),note);assert.equal(findPeaks(raw.values,20,22000,0)[0].k,bin);assert.equal(db.values[0],-Infinity);
}
for(let frame=1;frame<rows-1;frame++){assert.equal(frameAt(frame/60+.008,rows),frame);assert.equal(frameAt(frame/60-.008,rows),frame);assert.equal(frameAt(frame/60+.009,rows),frame+1)}
assert.equal(frameAt(-10,rows),0);assert.equal(frameAt(100,rows),rows-1);assert.deepEqual(values,before);assert.deepEqual(levels,beforeLevels);
assert.equal(findPeaks(new Float64Array(960),20,22000,0).length,0);
console.log('PASS: 1D nearest-frame selection, 3 tone registers, CQT/dBFS values, silence, boundaries and immutable source matrices');
const csv=sliceCSV(data,180).split('\n');assert.equal(csv.length,961);assert.equal(csv[0],'frame,time_seconds,frequency_hz,cqt,dbfs');const peak=csv[429].split(',').map(Number);assert.deepEqual(peak.slice(0,2),[180,3]);assert(Math.abs(peak[2]-440)<2);assert.equal(peak[3],1.75);assert(Math.abs(peak[4]+6.020599913)<1e-8);assert.equal(csv[1].split(',')[4],'-Infinity');console.log('PASS: CSV has 960 exact bins, frame/time, frequency, raw CQT, calibrated dBFS and explicit silence');
