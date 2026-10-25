import assert from 'node:assert/strict';
import ShowCQT from '../src/showcqt/showcqt-main.mjs';
import {calibrateDB,calibratedAmplitude} from '../src/db-calibration.mjs';
import {amplitudeDB,dbUnit} from '../public/signal-level.mjs';
const cqt=await ShowCQT.instantiate();cqt.init(44100,960,1,4,4,4);cqt.set_volume(19,10);
const reference=calibrateDB(cqt);let maxError=0,count=0;
for(const phase of [0,.37,Math.PI/2,2.4])for(let bin=0;bin<960;bin++)for(const amplitude of [1,.1,.01,.001]){
 const frequency=440*2**((15.5+(bin+.5)/8-69)/12);
 for(let n=0;n<cqt.fft_size;n++)cqt.inputs[0][n]=cqt.inputs[1][n]=amplitude*Math.sin(2*Math.PI*frequency*n/44100+phase);
 cqt.calc();const db=amplitudeDB(calibratedAmplitude(cqt.color[4*bin+1],reference[bin])),error=Math.abs(db-20*Math.log10(amplitude));maxError=Math.max(maxError,error);assert(error<.3,`${bin}: ${db}`);count++;
}
const bin=428,f=440*2**((15.5+(bin+.5)/8-69)/12);cqt.inputs[1].fill(0);for(let n=0;n<cqt.fft_size;n++)cqt.inputs[0][n]=.1*Math.sin(2*Math.PI*f*n/44100);cqt.calc();assert(Math.abs(amplitudeDB(calibratedAmplitude(cqt.color[4*bin+1],reference[bin]))-(-20-10*Math.log10(2)))<.1);
cqt.inputs[0].fill(0);cqt.calc();assert.equal(calibratedAmplitude(cqt.color[4*bin+1],reference[bin]),0);assert.equal(amplitudeDB(0),-Infinity);assert.equal(dbUnit(0),0);assert.equal(dbUnit(1),1);assert.equal(dbUnit(.001,-60),0);assert.equal(dbUnit(.001,-120),.5);
console.log(`PASS: ${count} independent-phase, bin-centered sine levels; max error ${maxError.toFixed(6)} dB; stereo energy convention, silence and fixed ranges`);
