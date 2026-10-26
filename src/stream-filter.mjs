// Preserve the original ShowCQT visualization filter bit-for-bit, but retain
// only the current FFT window instead of a second full-length PCM track.
export function createFilteredWindow(source,capacity,rate=44100){
 const ring=new Float32Array(capacity),A=10**(-30/40),unit=2*Math.PI*33/rate,b=-1+unit*A,a=-1+unit/A;
 let position=0,xp=0,yp=0,lastStart=-Infinity;
 return {fill(input,start){
  if(input.length!==capacity||start<lastStart)throw Error('Filter windows must advance in time');lastStart=start;
  const end=Math.max(0,Math.min(source.length,start+capacity));
  for(;position<end;position++){const x=source[position]+1e-9;yp=x+b*xp-a*yp;xp=x;ring[position%capacity]=yp+1e9-1e9}
  input.fill(0);const begin=Math.max(0,start);if(end<=begin)return;
  const offset=begin%capacity,count=end-begin,first=Math.min(count,capacity-offset);
  input.set(ring.subarray(offset,offset+first),begin-start);
  if(first<count)input.set(ring.subarray(0,count-first),begin-start+first);
 },get byteLength(){return ring.byteLength}};
}
