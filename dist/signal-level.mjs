export const amplitudeDB=amplitude=>amplitude>0?20*Math.log10(amplitude):-Infinity;
export const dbUnit=(amplitude,floor=-90)=>Math.max(0,Math.min(1,(amplitudeDB(amplitude)-floor)/-floor));
export function dbRGB(amplitude,palette,referenceRGB,floor=-90){
 const unit=dbUnit(amplitude,floor);if(!palette)return referenceRGB(unit,1);
 const scaled=unit*4,index=Math.min(3,Math.floor(scaled)),f=scaled-index;
 return palette[index].map((a,k)=>a*(1-f)+palette[index+1][k]*f);
}
