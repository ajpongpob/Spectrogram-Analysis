export function waveformEnvelope(left,right=left,bins=2048){
 bins=Math.max(1,Math.min(bins,left.length));const l=new Float32Array(bins*2),r=new Float32Array(bins*2),combined=new Float32Array(bins*2);
 for(let b=0;b<bins;b++){let lmin=0,lmax=0,rmin=0,rmax=0;for(let i=Math.floor(b*left.length/bins);i<Math.floor((b+1)*left.length/bins);i++){lmin=Math.min(lmin,left[i]);lmax=Math.max(lmax,left[i]);rmin=Math.min(rmin,right[i]);rmax=Math.max(rmax,right[i])}l.set([lmin,lmax],b*2);r.set([rmin,rmax],b*2);combined.set([Math.min(lmin,rmin),Math.max(lmax,rmax)],b*2)}
 return {left:l,right:r,combined,bins};
}
