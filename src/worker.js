import ShowCQT from './showcqt/showcqt-main.mjs';
import BZip2 from '@digitaldefiance/bzip2-wasm';

const RATE = 44100, WIDTH = 960, FPS = 60, HOP = 735;
const LOW = 20.015231264080075, OCTAVES = 10, TUNING = 440;
const encoder = new TextEncoder();
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[char]);

function notesAndBlend() {
  const notes=[], blend=new Float32Array(WIDTH), names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  for(let k=0;k<WIDTH;k++) {
    const hz=LOW*2**(OCTAVES*(k+.5)/WIDTH);
    const midi=Math.floor(69+12*Math.log2(hz/TUNING)+.5);
    notes.push(names[((midi%12)+12)%12]+(Math.floor(midi/12)-1));
    blend[k]=Math.max(0,Math.min(1,Math.log2(hz/1000)/Math.log2(4)));
  }
  return {notes,blend};
}

function filterInPlace(data) {
  const A=10**(-30/40), unit=2*Math.PI*33/RATE, b=-1+unit*A, a=-1+unit/A;
  let xp=0,yp=0;
  for(let i=0;i<data.length;i++){const x=data[i]+1e-9;yp=x+b*xp-a*yp;xp=x;data[i]=yp+1e9-1e9;}
}

function compressSession(bzip2, source) {
  // The wrapper captures HEAPU8 before _malloc. Large sessions make _malloc
  // grow WASM memory, which detaches that old view. Read HEAPU8 after each
  // allocation so full-length songs can be copied safely.
  const wasm = bzip2.wasmModule;
  const capacity = source.length + Math.ceil(source.length / 100) + 601;
  let sourcePtr = 0, destPtr = 0, lengthPtr = 0;
  try {
    sourcePtr = wasm._malloc(source.length);
    if (!sourcePtr) throw new Error('หน่วยความจำไม่พอสำหรับไฟล์วิเคราะห์');
    wasm.HEAPU8.set(source, sourcePtr);
    destPtr = wasm._malloc(capacity);
    lengthPtr = wasm._malloc(4);
    if (!destPtr || !lengthPtr) throw new Error('หน่วยความจำไม่พอสำหรับบีบอัดไฟล์');
    wasm.setValue(lengthPtr, capacity, 'i32');
    const code = wasm._BZ2_bzBuffToBuffCompress(destPtr, lengthPtr, sourcePtr, source.length, 9, 0, 30);
    if (code !== 0) throw new Error(`บีบอัดไฟล์ไม่สำเร็จ (รหัส ${code})`);
    const length = wasm.getValue(lengthPtr, 'i32');
    return wasm.HEAPU8.slice(destPtr, destPtr + length);
  } finally {
    if (sourcePtr) wasm._free(sourcePtr);
    if (destPtr) wasm._free(destPtr);
    if (lengthPtr) wasm._free(lengthPtr);
  }
}

self.onmessage = async ({data}) => {
  try {
    if(data.sampleRate!==RATE) throw new Error(`เบราว์เซอร์ถอดรหัสเป็น ${data.sampleRate} Hz แทน 44100 Hz กรุณาใช้ Chrome หรือ Edge รุ่นใหม่`);
    const left=new Float32Array(data.left), right=new Float32Array(data.right), total=left.length, frames=Math.ceil(total/HOP);
    filterInPlace(left); filterInPlace(right);
    const cqt=await ShowCQT.instantiate(); cqt.init(RATE,WIDTH,1,4,4,4); cqt.set_volume(19,10);
    const fft=cqt.fft_size, anchor=fft-Math.ceil(RATE*.033), {notes,blend}=notesAndBlend();
    const accent=.2126*.4+.7152*.2+.0722*.8, vals=new Float32Array(WIDTH);
    const previewWidth=960,previewHeight=320,preview=new Uint8Array(previewWidth*previewHeight);
    const title='ShowCQT Musical Detail v1 - 60fps - display intensity, not dB';
    const audioName=escapeXml(data.fileName);
    const start=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE sonic-visualiser><sv><data><model id="0" name="Original audio" sampleRate="${RATE}" start="0" end="${total}" type="wavefile" file="${audioName}" mainModel="true"/><model id="1" name="${title}" sampleRate="${RATE}" type="dense" dimensions="3" windowSize="${HOP}" yBinCount="${WIDTH}" minimum="0" maximum="1" dataset="1" startFrame="0"/><dataset id="1" dimensions="3" separator=" ">${notes.map((n,k)=>`<bin number="${k}" name="${n}"/>`).join('')}`;
    const end=`</dataset><layer id="2" type="timeruler" name="Time" model="0" colourName="White" colour="#ffffff" darkBackground="true"/><layer id="3" type="colour3dplot" name="${title}" model="1" scale="0" minY="0" maxY="0" invertVertical="false" opaque="true" binScale="0" smooth="true" gain="1" colourMap="Magma" colourScheme="1" columnNormalization="none" normalizeColumns="false" normalizeVisibleArea="false"/></data><display><window width="1100" height="850"/><view centre="${Math.round(Math.min(19,total/RATE/2)*RATE)}" zoom="512" deepZoom="1" followPan="1" followZoom="1" tracking="page" type="pane" centreLineVisible="1" height="700"><layer id="2" type="timeruler" name="Time" model="0" visible="true"/><layer id="3" type="colour3dplot" name="${title}" model="1" visible="true"/></view></display><selections/></sv>`;

    function makeRow(t) {
      const startSample=t*HOP-anchor;
      for(const [channel,input] of [[left,cqt.inputs[0]],[right,cqt.inputs[1]]]){input.fill(0);const lo=Math.max(0,startSample),hi=Math.min(total,startSample+fft);if(hi>lo)input.set(channel.subarray(lo,hi),lo-startSample);}
      cqt.calc(); const colors=cqt.color;
      for(let k=0;k<WIDTH;k++) vals[k]=Math.max(0,Math.min(1,colors[4*k+1]));
      for(let k=1;k<WIDTH-1&&4*k+2<.6*colors.length;k++){const j=4*k;if(colors[j+3]<=colors[j-1]||colors[j+3]<colors[j+7])continue;const alpha=Math.cos(.5*Math.PI*(j+2)/(.6*colors.length))**2;vals[k]*=1-alpha+alpha*accent;}
      for(let k=0;k<WIDTH;k++){const x=vals[k], curved=Math.max(0,(x-.045)/.955)**1.35;vals[k]=x*(1-blend[k])+curved*blend[k];}
      const px=Math.min(previewWidth-1,Math.floor(t*previewWidth/frames));
      for(let py=0;py<previewHeight;py++){const k=Math.min(WIDTH-1,Math.floor(py*WIDTH/previewHeight));const v=Math.round(vals[k]*255),j=py*previewWidth+px;if(v>preview[j])preview[j]=v;}
      if(t%(FPS*5)===0) self.postMessage({type:'progress',value:.88*t/frames,message:`กำลังวิเคราะห์ ${Math.floor(t/FPS)} / ${Math.ceil(total/RATE)} วินาที`});
      return `<row n="${t}">${Array.from(vals,x=>x.toPrecision(5)).join(' ')}</row>\n`;
    }

    const chunks=[encoder.encode(start)]; let xmlLength=chunks[0].length;
    for(let t=0;t<frames;t++){const chunk=encoder.encode(makeRow(t));chunks.push(chunk);xmlLength+=chunk.length;}
    const tail=encoder.encode(end);chunks.push(tail);xmlLength+=tail.length;
    self.postMessage({type:'progress',value:.9,message:'กำลังประกอบไฟล์ Sonic Visualiser…'});
    const xml=new Uint8Array(xmlLength); let offset=0;
    for(const chunk of chunks){xml.set(chunk,offset);offset+=chunk.length;}
    chunks.length=0;
    self.postMessage({type:'progress',value:.94,message:'กำลังบีบอัดไฟล์ .sv…'});
    const bzip2=new BZip2(); await bzip2.init();
    const bytes=compressSession(bzip2,xml);
    self.postMessage({type:'done',bytes:bytes.buffer,preview:preview.buffer,previewWidth,previewHeight},[bytes.buffer,preview.buffer]);
  } catch(error) {
    self.postMessage({type:'error',message:error?.message||String(error)});
  }
};
