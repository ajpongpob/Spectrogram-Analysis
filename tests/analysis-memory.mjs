import assert from 'node:assert/strict';
import {createFilteredWindow} from '../src/stream-filter.mjs';
import {analysisMemory} from '../src/analysis-memory.mjs';
const n=100003,source=Float32Array.from({length:n},(_,i)=>Math.sin(i*.12)*.7),original=source.slice(),filtered=source.slice(),capacity=16384;
const A=10**(-30/40),unit=2*Math.PI*33/44100,b=-1+unit*A,a=-1+unit/A;let xp=0,yp=0;
for(let i=0;i<n;i++){const x=filtered[i]+1e-9;yp=x+b*xp-a*yp;xp=x;filtered[i]=yp+1e9-1e9}
const stream=createFilteredWindow(source,capacity),input=new Float32Array(capacity);
for(let start=-capacity+1456;start<n+capacity;start+=735){const expected=new Float32Array(capacity),lo=Math.max(0,start),hi=Math.min(n,start+capacity);if(hi>lo)expected.set(filtered.subarray(lo,hi),lo-start);stream.fill(input,start);assert.deepEqual(input,expected);stream.fill(input,start);assert.deepEqual(input,expected)}
assert.deepEqual(source,original);assert.equal(stream.byteLength,capacity*4);
const track={length:44100*480,channels:2,fileBytes:44100*480*4+44},memory=analysisMemory(track,{deviceMemory:8,heapLimit:4*1024**3});assert(memory.fits);assert(track.length*16+480*60*960*9>512*1024**2);assert(!analysisMemory({...track,length:44100*3600},{deviceMemory:2}).fits);assert(analysisMemory({...track,channels:1}).estimated<memory.estimated);
console.log('PASS: bit-exact rolling filter, overlap/zero padding/tail/shared mono, unchanged PCM, memory guard; eight-minute stereo estimate',Math.ceil(memory.estimated/1024**2),'MiB');
