export const binHz=k=>440*2**((15.5+(k+.5)/8-69)/12);
export const db=a=>a>0?20*Math.log10(a):-Infinity;
export const frameAt=(time,rows)=>Math.max(0,Math.min(rows-1,Math.round(time*60)));
export function slice(data,time,mode){const frame=frameAt(time,data.rows),source=mode==='db'?data.levels:data.values;return {frame,time:frame/60,values:Float64Array.from(source.subarray(frame*960,(frame+1)*960),v=>mode==='db'?db(v):v)}}
export function findPeaks(values,minHz,maxHz,threshold=-Infinity){const out=[];for(let k=1;k<959;k++){const hz=binHz(k),value=values[k];if(hz>=minHz&&hz<=maxHz&&Number.isFinite(value)&&value>threshold&&value>values[k-1]&&value>=values[k+1])out.push({k,hz,value})}return out.sort((a,b)=>b.value-a.value).filter((p,i,all)=>!all.slice(0,i).some(q=>Math.abs(q.k-p.k)<8)).slice(0,6)}
export function noteLabel(hz){const midi=Math.round(69+12*Math.log2(hz/440));return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][(midi%12+12)%12]+(Math.floor(midi/12)-1)}
export function sliceCSV(data,frame){
 const lines=['frame,time_seconds,frequency_hz,cqt,dbfs'];
 for(let k=0;k<960;k++)lines.push([frame,frame/60,binHz(k),data.values[frame*960+k],data.levels?db(data.levels[frame*960+k]):''].join(','));
 return lines.join('\n');
}
