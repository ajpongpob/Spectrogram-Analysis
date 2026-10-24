/* Adapted from YouTube Musical Spectrum 20.0.2, ColorRotation/detect_peak.
 * Copyright (c) 2024 Muhammad Faiz <mfcc64@gmail.com>
 * Modifications 2026: pure functions, configurable linear input gain and tests.
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * See COPYING and COPYING.LESSER.
 */
export function referenceTable(saturation=20,hue=-3,hueRange=18) {
 const kr=.2126,kb=.0722,kg=1-kr-kb,k=2/Math.sqrt(3);
 const matrix=[[1,2*(kb+kg),k*(kb-kg)],[1,-2*kr,k*(kb-kg+1)],[1,-2*kr,k*(kb-kg-1)]];
 const table=new Float32Array(3006),sat=10**(saturation/10-1);
 for(let i=0;i<=1001;i++){
  let y=Math.min(1,i/1000),h=Math.PI/18*(hue-hueRange/2)+Math.sin(Math.PI*y/2)*Math.PI/18*hueRange;
  h-=.23*Math.sin(3*h);y*=y;
  const u=Math.cos(h),v=Math.sin(h),rgb=matrix.map(m=>y+m[1]*u+m[2]*v);
  const sum=rgb.reduce((s,c)=>s+Math.exp((c-y)*y*sat)+Math.exp((y-c)*(1-y)*sat),0);
  const scale=y*(1-y)*sat/Math.log(sum);
  matrix.forEach((m,c)=>table[3*i+c]=Math.max(0,y+scale*(m[1]*u+m[2]*v))**(1/2.2));
 }
 return table;
}
export const referenceColors=referenceTable();
export function referenceRGB(raw,gain=1,table=referenceColors){
 const x=Math.max(0,Math.min(1,raw*gain))*1000,i=Math.floor(x),f=x-i;
 return [0,1,2].map(c=>255*(table[3*i+c]*(1-f)+table[3*i+3+c]*f));
}
export function peakMask(colors,width=colors.length/4){
 const mask=new Uint8Array(width),range=72/120*colors.length;
 for(let k=4;k+2<range&&k<colors.length-4;k+=4){
  if(colors[k+3]<=colors[k-1]||colors[k+3]<colors[k+7])continue;
  mask[k/4]=Math.round(255*Math.cos(.5*Math.PI*(k+2)/range)**2);
 }
 return mask;
}
export function legacyIntensity(raw,bin){
 const f=20.015231264080075*2**(10*(bin+.5)/960),blend=Math.max(0,Math.min(1,Math.log2(f/1000)/2));
 const x=1-Math.exp(-Math.max(0,raw));return x*(1-blend)+x**1.35*blend;
}
