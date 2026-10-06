import './style.css';

const $ = id => document.getElementById(id);
const drop = $('drop-zone');
const input = $('file-input');
const job = $('job');
const result = $('result');
const errorBox = $('error');
const canvas = $('preview');
const ctx = canvas.getContext('2d');
let worker;
let downloadUrl;
let outputName;

const fmtSize = bytes => bytes < 1e6 ? `${(bytes / 1e3).toFixed(0)} KB` : `${(bytes / 1e6).toFixed(1)} MB`;
const fmtTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;

function setProgress(value, text) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  $('meter-fill').style.width = `${pct}%`;
  $('percent').textContent = `${pct}%`;
  $('status').textContent = text;
}

function reset() {
  worker?.terminate();
  worker = undefined;
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
  result.hidden = true;
  errorBox.hidden = true;
  job.hidden = true;
  drop.hidden = false;
  input.value = '';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setProgress(0, 'กำลังเตรียมเสียง…');
}

async function decode(file) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการถอดรหัสเสียง กรุณาใช้ Chrome, Edge หรือ Safari รุ่นใหม่');
  const audio = new AudioCtx({ sampleRate: 44100 });
  try {
    const buffer = await audio.decodeAudioData(await file.arrayBuffer());
    const left = new Float32Array(buffer.getChannelData(0));
    const sourceRight = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0);
    const right = new Float32Array(sourceRight);
    return { left, right, duration: buffer.duration, sampleRate: buffer.sampleRate };
  } finally {
    await audio.close();
  }
}

async function analyse(file) {
  if (!/\.(mp3|wav)$/i.test(file.name)) {
    throw new Error('รองรับเฉพาะไฟล์ MP3 และ WAV');
  }
  drop.hidden = true;
  job.hidden = false;
  result.hidden = true;
  errorBox.hidden = true;
  $('file-name').textContent = file.name;
  $('file-meta').textContent = `${fmtSize(file.size)} · กำลังอ่านข้อมูลเสียง`;
  setProgress(2, 'กำลังถอดรหัสและปรับเป็น 44.1 kHz…');

  const decoded = await decode(file);
  $('file-meta').textContent = `${fmtSize(file.size)} · ${fmtTime(decoded.duration)} · วิเคราะห์ที่ 44.1 kHz`;
  setProgress(5, 'กำลังเริ่ม ShowCQT Musical Detail…');

  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') setProgress(5 + data.value * 0.92, data.message);
    if (data.type === 'done') {
      const blob = new Blob([data.bytes], { type: 'application/x-sonicvisualiser' });
      downloadUrl = URL.createObjectURL(blob);
      outputName = `${file.name.replace(/\.[^.]+$/, '')}-Musical-Detail.sv`;
      setProgress(100, 'วิเคราะห์และบีบอัดเสร็จแล้ว');
      drawPreview(new Uint8Array(data.preview), data.previewWidth, data.previewHeight);
      result.hidden = false;
      worker.terminate();
      worker = undefined;
    }
    if (data.type === 'error') showError(data.message);
  };
  worker.onerror = event => showError(event.message || 'เกิดข้อผิดพลาดระหว่างวิเคราะห์');
  worker.postMessage({ left: decoded.left.buffer, right: decoded.right.buffer, sampleRate: decoded.sampleRate, fileName: file.name }, [decoded.left.buffer, decoded.right.buffer]);
}

function showError(message) {
  worker?.terminate();
  worker = undefined;
  errorBox.textContent = `ไม่สำเร็จ: ${message}`;
  errorBox.hidden = false;
  result.hidden = true;
  setProgress(0, 'หยุดการทำงาน');
}

function magma(t) {
  const stops = [[0,[0,0,4]],[.25,[81,18,124]],[.5,[183,55,121]],[.75,[252,137,97]],[1,[252,253,191]]];
  let i = 1; while (i < stops.length && t > stops[i][0]) i++;
  const [a, ca] = stops[i-1], [b, cb] = stops[Math.min(i, stops.length-1)];
  const q = b === a ? 0 : (t-a)/(b-a);
  return ca.map((v,j) => Math.round(v+(cb[j]-v)*q));
}

function drawPreview(values, width, height) {
  const image = ctx.createImageData(width, height);
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const [r,g,b] = magma(values[(height-1-y)*width+x]/255);
    const j=(y*width+x)*4; image.data[j]=r; image.data[j+1]=g; image.data[j+2]=b; image.data[j+3]=255;
  }
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  off.getContext('2d').putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.drawImage(off,0,0,canvas.width,canvas.height);
}

drop.addEventListener('click', () => input.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('dragging'); const file=e.dataTransfer.files[0]; if(file) analyse(file).catch(e=>showError(e.message)); });
input.addEventListener('change', () => { const file=input.files[0]; if(file) analyse(file).catch(e=>showError(e.message)); });
$('change-file').addEventListener('click', reset);
$('download').addEventListener('click', () => {
  const a=document.createElement('a'); a.href=downloadUrl; a.download=outputName;
  document.body.appendChild(a); a.click(); setTimeout(()=>a.remove(),0);
});
