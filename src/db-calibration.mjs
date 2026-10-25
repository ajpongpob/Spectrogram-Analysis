// Bin-centered, equal-channel sine reference: amplitude 1 peak = 0 dBFS.
// ShowCQT green = sqrt(sono_v * stereo RMS spectral amplitude).
export function calibrateDB(cqt,rate=44100,width=960){
 const reference=new Float32Array(width);
 for(let bin=0;bin<width;bin++){
  const f=440*2**((15.5+(bin+.5)/8-69)/12);
  for(let n=0;n<cqt.fft_size;n++)cqt.inputs[0][n]=.5*Math.sin(2*Math.PI*f*n/rate);
  cqt.inputs[1].set(cqt.inputs[0]);cqt.calc();const sine=cqt.color[4*bin+1];
  for(let n=0;n<cqt.fft_size;n++)cqt.inputs[0][n]=.5*Math.cos(2*Math.PI*f*n/rate);
  cqt.inputs[1].set(cqt.inputs[0]);cqt.calc();const cosine=cqt.color[4*bin+1];
  reference[bin]=((sine**4+cosine**4)/2)**.25;
  if(!(reference[bin]>0))throw Error('Invalid dB reference');
 }
 return reference;
}
export const calibratedAmplitude=(green,reference)=>.5*(green/reference)**2;
