import ShowCQT from './showcqt/showcqt-main.mjs';
import {calibrateDB,calibratedAmplitude} from './db-calibration.mjs';
import {peakMask} from '../public/reference-color.mjs';
const RATE=44100,WIDTH=960,HOP=735;
function filter(data){const A=10**(-30/40),unit=2*Math.PI*33/RATE,b=-1+unit*A,a=-1+unit/A;let xp=0,yp=0;for(let i=0;i<data.length;i++){const x=data[i]+1e-9;yp=x+b*xp-a*yp;xp=x;data[i]=yp+1e9-1e9}}
self.onmessage=async({data})=>{try{
 if(data.sampleRate!==RATE)throw Error('ต้องวิเคราะห์ที่ 44.1 kHz');
 const left=new Float32Array(data.left),right=new Float32Array(data.right),total=left.length,rows=Math.ceil(total/HOP);
 const filteredLeft=left.slice(),filteredRight=right.slice();filter(filteredLeft);filter(filteredRight);
 const cqt=await ShowCQT.instantiate();cqt.init(RATE,WIDTH,1,4,4,4);cqt.set_volume(19,10);
 const dbReference=calibrateDB(cqt);
 const fft=cqt.fft_size,anchor=fft-Math.ceil(RATE*.033),values=new Float32Array(rows*WIDTH),peaks=new Uint8Array(rows*WIDTH),levels=new Float32Array(rows*WIDTH);
 for(let t=0;t<rows;t++){
  const start=t*HOP-anchor;
  for(const [channel,input] of [[left,cqt.inputs[0]],[right,cqt.inputs[1]]]){input.fill(0);const lo=Math.max(0,start),hi=Math.min(total,start+fft);if(hi>lo)input.set(channel.subarray(lo,hi),lo-start)}
  cqt.calc();for(let k=0;k<WIDTH;k++)levels[t*WIDTH+k]=calibratedAmplitude(cqt.color[4*k+1],dbReference[k]);
  for(const [channel,input] of [[filteredLeft,cqt.inputs[0]],[filteredRight,cqt.inputs[1]]]){input.fill(0);const lo=Math.max(0,start),hi=Math.min(total,start+fft);if(hi>lo)input.set(channel.subarray(lo,hi),lo-start)}
  cqt.calc();const colours=cqt.color;for(let k=0;k<WIDTH;k++)values[t*WIDTH+k]=colours[4*k+1];
  peaks.set(peakMask(colours),t*WIDTH);
  if(t%120===0)self.postMessage({type:'progress',value:t/rows,seconds:t/60});
 }
 self.postMessage({type:'done',encoding:'raw-cqt-v1',values:values.buffer,levels:levels.buffer,peaks:peaks.buffer,rows,duration:total/RATE},[values.buffer,levels.buffer,peaks.buffer]);
}catch(e){self.postMessage({type:'error',message:e.message})}};
