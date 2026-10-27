import assert from 'node:assert/strict';
import {analyseCQT} from '../src/analyse-cqt.mjs';
import {waveformEnvelope} from '../src/waveform-data.mjs';
import {analysisMemory} from '../src/analysis-memory.mjs';
import {binHz} from '../public/spectrum-math.mjs';
const rate=44100,n=rate*2,kL=332,kR=524;
const left=Float32Array.from({length:n},(_,i)=>.5*Math.sin(2*Math.PI*binHz(kL)*i/rate));
const right=Float32Array.from({length:n},(_,i)=>.25*Math.sin(2*Math.PI*binHz(kR)*i/rate));
const l=await analyseCQT(left),r=await analyseCQT(right),mix=await analyseCQT(left,right),silence=await analyseCQT(new Float32Array(n));
const amplitude=(d,k)=>new Float32Array(d.levels)[60*960+k];
for(const [d,k,a] of [[l,kL,.5],[r,kR,.25],[mix,kL,.5/Math.sqrt(2)],[mix,kR,.25/Math.sqrt(2)]])assert(Math.abs(20*Math.log10(amplitude(d,k)/a))<.3);
assert(amplitude(l,kR)<.0001);assert(amplitude(r,kL)<.0001);assert(new Float32Array(silence.levels).every(v=>v===0));
for(const [d,k] of [[l,kL],[r,kR]]){const values=new Float32Array(d.values).slice(60*960,61*960);assert(Math.abs(values.indexOf(Math.max(...values))-k)<=1)}
const waveform=waveformEnvelope(Float32Array.of(1,-.5,0,0),Float32Array.of(0,0,-1,.25),2);assert.deepEqual([...waveform.left],[ -.5,1,0,0]);assert.deepEqual([...waveform.right],[0,0,-1,.25]);assert.deepEqual([...waveform.combined],[-.5,1,-1,.25]);
const base={length:rate*300,channels:2,fileBytes:1000000};assert(analysisMemory({...base,stereo:true}).estimated>analysisMemory(base).estimated);assert(!analysisMemory({...base,length:rate*3600,stereo:true},{deviceMemory:2}).fits);
console.log('PASS: independent L/R frequencies, per-channel calibrated levels, unchanged stereo energy convention, silence, waveform envelope and stereo memory guard');
