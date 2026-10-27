import {analyseCQT} from './analyse-cqt.mjs';
self.onmessage=async({data})=>{try{
 if(data.sampleRate!==44100)throw Error('ต้องวิเคราะห์ที่ 44.1 kHz');
 const left=new Float32Array(data.left),right=data.left===data.right?left:new Float32Array(data.right);
 if(data.stereo){
  const l=await analyseCQT(left,left,(value)=>self.postMessage({type:'progress',value:value/2}));
  const r=await analyseCQT(right,right,(value)=>self.postMessage({type:'progress',value:.5+value/2}));
  self.postMessage({type:'stereo-done',left:l,right:r},[l.values,l.levels,l.peaks,r.values,r.levels,r.peaks]);
 }else{
  const result=await analyseCQT(left,right,(value,seconds)=>self.postMessage({type:'progress',value,seconds}));
  self.postMessage({type:'done',...result},[result.values,result.levels,result.peaks]);
 }
}catch(e){self.postMessage({type:'error',message:e.message})}};
