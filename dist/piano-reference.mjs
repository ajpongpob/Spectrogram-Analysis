export const referenceFrequency=midi=>440*2**((midi-69)/12);
// A short, tuned piano-like voice. Harmonics stay below Nyquist at every register.
export function createPianoVoice(context,midi,when=context.currentTime){
 const frequency=referenceFrequency(midi),output=context.createGain(),voices=[];
 output.gain.setValueAtTime(.13,when);output.connect(context.destination);
 const partials=[1,.42,.24,.12,.07,.035],duration=Math.max(.7,Math.min(2.2,1.8*2**((60-midi)/48)));
 for(let i=0;i<partials.length;i++){
  const hz=frequency*(i+1);if(hz>=context.sampleRate*.47)break;
  const oscillator=context.createOscillator(),envelope=context.createGain(),end=when+duration/(1+i*.2);
  oscillator.type='sine';oscillator.frequency.setValueAtTime(hz,when);envelope.gain.setValueAtTime(0,when);
  envelope.gain.linearRampToValueAtTime(partials[i],when+.005);envelope.gain.exponentialRampToValueAtTime(.0001,end);
  oscillator.connect(envelope);envelope.connect(output);oscillator.start(when);oscillator.stop(end+.03);voices.push(oscillator);
  oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect()};
 }
 let timer;return {frequency,duration,stop(){clearTimeout(timer);output.gain.setTargetAtTime(.0001,context.currentTime,.015);for(const o of voices)try{o.stop(context.currentTime+.08)}catch{}timer=setTimeout(()=>output.disconnect(),120)},dispose(){output.disconnect()}};
}
let context,active=[];
export async function playReferenceNote(midi){
 midi=Math.round(midi);if(!Number.isFinite(midi)||midi<16||midi>135)return null;
 context??=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')await context.resume();
 const voice=createPianoVoice(context,midi);active.push(voice);if(active.length>8)active.shift().stop();
 setTimeout(()=>{voice.dispose();active=active.filter(v=>v!==voice)},(voice.duration+.2)*1000);
 const detail={midi,frequency:voice.frequency};window.dispatchEvent(new CustomEvent('lab-reference-note',{detail}));return detail;
}
