import {createFilteredWindow} from './stream-filter.mjs';
import ShowCQT from './showcqt/showcqt-main.mjs';
import {calibrateDB,calibratedAmplitude} from './db-calibration.mjs';
import {peakMask} from '../public/reference-color.mjs';
export async function analyseCQT(left,right=left,onProgress=()=>{}){
 const RATE=44100,WIDTH=960,HOP=735,total=left.length,rows=Math.ceil(total/HOP);
 const cqt=await ShowCQT.instantiate();cqt.init(RATE,WIDTH,1,4,4,4);cqt.set_volume(19,10);
 const dbReference=calibrateDB(cqt),fft=cqt.fft_size,anchor=fft-Math.ceil(RATE*.033);
 const values=new Float32Array(rows*WIDTH),peaks=new Uint8Array(rows*WIDTH),levels=new Float32Array(rows*WIDTH);
 let maxValue=0;
 const filteredLeft=createFilteredWindow(left,fft),filteredRight=left===right?filteredLeft:createFilteredWindow(right,fft);
 for(let t=0;t<rows;t++){
  const start=t*HOP-anchor;
  for(const [channel,input] of [[left,cqt.inputs[0]],[right,cqt.inputs[1]]]){input.fill(0);const lo=Math.max(0,start),hi=Math.min(total,start+fft);if(hi>lo)input.set(channel.subarray(lo,hi),lo-start)}
  cqt.calc();for(let k=0;k<WIDTH;k++)levels[t*WIDTH+k]=calibratedAmplitude(cqt.color[4*k+1],dbReference[k]);
  filteredLeft.fill(cqt.inputs[0],start);filteredRight.fill(cqt.inputs[1],start);cqt.calc();
  for(let k=0;k<WIDTH;k++){const value=cqt.color[4*k+1];values[t*WIDTH+k]=value;maxValue=Math.max(maxValue,value)}peaks.set(peakMask(cqt.color),t*WIDTH);
  if(t%120===0)onProgress(t/rows,t/60);
 }
 return {maxValue,encoding:'raw-cqt-v1',values:values.buffer,levels:levels.buffer,peaks:peaks.buffer,rows,duration:total/RATE};
}
