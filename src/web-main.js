import './lab.css';
const {t,setText,initLanguage}=await import(/* @vite-ignore */ new URL('./i18n.mjs?v=shapes-1',document.baseURI).href);
const $=id=>document.getElementById(id),drop=$('drop-zone'),input=$('file-input');
initLanguage();
let worker,jobId=0,frame,pending;
function progress(p,key,params){$('meter-fill').style.width=p+'%';$('percent').textContent=Math.round(p)+'%';setText($('status'),key,params)}
function reset(){jobId++;worker?.terminate();worker=null;frame?.remove();frame=null;pending=null;document.body.classList.remove('has-viewer','viewer-expanded');$('viewer-host').hidden=true;$('job').hidden=true;$('error').hidden=true;drop.hidden=false;input.value=''}
function fault(key){const error=new Error(t(key));error.translationKey=key;return error}
function failure(error){worker?.terminate();worker=null;pending=null;setText($('error'),error.translationKey||'errorDetail',{message:error?.message||String(error)});$('error').hidden=false;progress(0,'failed');$('cancel').hidden=true;$('change-file').hidden=false}
async function analyse(file){reset();const id=jobId;$('job').hidden=false;drop.hidden=true;$('cancel').hidden=false;$('change-file').hidden=true;$('file-name').textContent=file.name;
 try{
  if(!/\.(mp3|wav)$/i.test(file.name))throw fault('badType');
  if(file.size>250*1024*1024)throw fault('tooLarge');
  progress(2,'reading');
  const raw=await file.arrayBuffer();if(id!==jobId)return;
  const hash=await crypto.subtle.digest('SHA-256',raw);if(id!==jobId)return;
  const key=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  const ac=new AudioContext({sampleRate:44100});let buffer;
  try{buffer=await ac.decodeAudioData(raw)}catch{throw fault('decodeError')}finally{await ac.close()}
  if(id!==jobId)return;
  const duration=buffer.duration;
  if(!duration||duration<.1)throw fault('tooShort');
  const estimate=buffer.length*8+Math.ceil(duration*60)*960*5;
  if(estimate>512*1024*1024)throw fault('tooLong');
  const left=new Float32Array(buffer.getChannelData(0)),right=new Float32Array(buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1))),sampleRate=buffer.sampleRate;buffer=null;
  setText($('file-meta'),'fileMeta',{size:(file.size/1e6).toFixed(1),duration:`${Math.floor(duration/60)}:${String(Math.floor(duration%60)).padStart(2,'0')}`});
  progress(5,'analysing');worker=new Worker(new URL('./analysis-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(id!==jobId)return;if(data.type==='progress')progress(5+90*data.value,'analysisProgress',{seconds:Math.floor(data.seconds),duration:Math.ceil(duration)});
   if(data.type==='error')failure(Error(data.message));
   if(data.type==='done'){worker.terminate();worker=null;pending={...data,type:'analysis-ready',audio:file,key,name:file.name};progress(97,'opening');frame=document.createElement('iframe');frame.dataset.i18nTitle='viewerTitle';frame.title=t('viewerTitle');frame.src=new URL('./viewer.html',document.baseURI).href;frame.allow='clipboard-read; clipboard-write; fullscreen';frame.allowFullscreen=true;$('viewer-host').replaceChildren(frame);$('viewer-host').hidden=false;$('cancel').hidden=true}
  };
  worker.onerror=e=>{if(id===jobId)failure(Error(e.message||t('failed')))};
  worker.postMessage({left:left.buffer,right:right.buffer,sampleRate},[left.buffer,right.buffer]);
 }catch(e){if(id===jobId)failure(e)}
}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='viewer-expanded')document.body.classList.toggle('viewer-expanded',e.data.expanded===true);if(e.data?.type==='viewer-height'&&Number.isFinite(e.data.height)){frame.style.height=Math.max(400,Math.min(4000,e.data.height+4))+'px'}if(e.data?.type==='viewer-listening'&&pending){const data=pending;pending=null;frame.contentWindow.postMessage(data,location.origin,[data.values,...(data.peaks?[data.peaks]:[])])}if(e.data?.type==='viewer-ready'){progress(100,'ready');$('change-file').hidden=false;document.body.classList.add('has-viewer');frame.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}if(e.data?.type==='viewer-error')failure(Error(e.data.message))});
drop.onclick=()=>input.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};
drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');if(e.dataTransfer.files[0])analyse(e.dataTransfer.files[0])};
input.onchange=()=>{if(input.files[0])analyse(input.files[0])};$('cancel').onclick=reset;$('change-file').onclick=reset;
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());

input.disabled=false;drop.removeAttribute('aria-disabled');
