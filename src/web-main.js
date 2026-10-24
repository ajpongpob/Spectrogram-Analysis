import './style.css';
const $=id=>document.getElementById(id),drop=$('drop-zone'),input=$('file-input');
let worker,jobId=0,frame,pending;
function progress(p,text){$('meter-fill').style.width=p+'%';$('percent').textContent=Math.round(p)+'%';$('status').textContent=text}
function reset(){jobId++;worker?.terminate();worker=null;frame?.remove();frame=null;pending=null;$('viewer-host').hidden=true;$('job').hidden=true;$('error').hidden=true;drop.hidden=false;input.value=''}
function failure(error){worker?.terminate();worker=null;pending=null;$('error').textContent=error?.message||String(error);$('error').hidden=false;progress(0,'ไม่สำเร็จ — เลือกไฟล์ใหม่ได้');$('cancel').hidden=true;$('change-file').hidden=false}
async function analyse(file){reset();const id=jobId;$('job').hidden=false;drop.hidden=true;$('cancel').hidden=false;$('change-file').hidden=true;$('file-name').textContent=file.name;
 try{
  if(!/\.(mp3|wav)$/i.test(file.name))throw Error('กรุณาเลือกไฟล์ MP3 หรือ WAV');
  if(file.size>250*1024*1024)throw Error('ไฟล์ใหญ่กว่า 250 MB กรุณาใช้ MP3 หรือแบ่งช่วงเสียงก่อน');
  progress(2,'กำลังอ่านไฟล์เสียง…');
  const raw=await file.arrayBuffer();if(id!==jobId)return;
  const hash=await crypto.subtle.digest('SHA-256',raw);if(id!==jobId)return;
  const key=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  const ac=new AudioContext({sampleRate:44100});let buffer;
  try{buffer=await ac.decodeAudioData(raw)}finally{await ac.close()}
  if(id!==jobId)return;
  const duration=buffer.duration;
  if(!duration||duration<.1)throw Error('ไฟล์เสียงสั้นเกินไป หรือไม่มีข้อมูลเสียง');
  const estimate=buffer.length*8+Math.ceil(duration*60)*960*5;
  if(estimate>512*1024*1024)throw Error('เพลงนี้ใช้หน่วยความจำมาก กรุณาแบ่งเป็นช่วงละไม่เกินประมาณ 15 นาที');
  const left=new Float32Array(buffer.getChannelData(0)),right=new Float32Array(buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1))),sampleRate=buffer.sampleRate;buffer=null;
  $('file-meta').textContent=`${(file.size/1e6).toFixed(1)} MB · ${Math.floor(duration/60)}:${String(Math.floor(duration%60)).padStart(2,'0')} · วิเคราะห์ในเครื่อง`;
  progress(5,'กำลังวิเคราะห์ ShowCQT…');worker=new Worker(new URL('./analysis-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(id!==jobId)return;if(data.type==='progress')progress(5+90*data.value,`กำลังวิเคราะห์ ${Math.floor(data.seconds)} / ${Math.ceil(duration)} วินาที`);
   if(data.type==='error')failure(Error(data.message));
   if(data.type==='done'){worker.terminate();worker=null;pending={...data,type:'analysis-ready',audio:file,key,name:file.name};progress(97,'กำลังเปิดภาพ…');frame=document.createElement('iframe');frame.title='ภาพวิเคราะห์และเครื่องมือเขียนกำกับ';frame.src=new URL('./viewer.html',document.baseURI).href;frame.allow='clipboard-read; clipboard-write';$('viewer-host').replaceChildren(frame);$('viewer-host').hidden=false;$('cancel').hidden=true}
  };
  worker.onerror=e=>{if(id===jobId)failure(Error(e.message||'วิเคราะห์ไม่สำเร็จ'))};
  worker.postMessage({left:left.buffer,right:right.buffer,sampleRate},[left.buffer,right.buffer]);
 }catch(e){if(id===jobId)failure(e)}
}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame?.contentWindow)return;if(e.data?.type==='viewer-height'&&Number.isFinite(e.data.height)){frame.style.height=Math.max(400,Math.min(4000,e.data.height+4))+'px'}if(e.data?.type==='viewer-listening'&&pending){const data=pending;pending=null;frame.contentWindow.postMessage(data,location.origin,[data.values,...(data.peaks?[data.peaks]:[])])}if(e.data?.type==='viewer-ready'){progress(100,'พร้อมใช้งาน — เล่นเสียง ซูม เขียนกำกับ และคัดลอกภาพได้');$('change-file').hidden=false;frame.scrollIntoView({behavior:'smooth',block:'start'})}if(e.data?.type==='viewer-error')failure(Error(e.data.message))});
drop.onclick=()=>input.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}};
drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging')};drop.ondragleave=()=>drop.classList.remove('dragging');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');if(e.dataTransfer.files[0])analyse(e.dataTransfer.files[0])};
input.onchange=()=>{if(input.files[0])analyse(input.files[0])};$('cancel').onclick=reset;$('change-file').onclick=reset;
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
