const MiB=1024*1024;
// A conservative working-set budget, not an instruction to allocate it all.
export function memoryBudget({deviceMemory,heapLimit}={}){
 let budget=768*MiB;
 if(Number.isFinite(deviceMemory)&&deviceMemory>0)budget=Math.min(1024,deviceMemory*128)*MiB;
 if(Number.isFinite(heapLimit)&&heapLimit>0)budget=Math.min(budget,heapLimit*.3);
 return Math.max(128*MiB,Math.floor(budget));
}
export function analysisMemory({length,sampleRate=44100,channels=2,fileBytes=0,stereo=false},capabilities={}){
 const duration=length/sampleRate,retainedChannels=Math.min(2,channels),pcm=length*retainedChannels*4,analysis=Math.ceil(length/735)*960*9;
 // Decoding/copying and worker analysis are separate stages. Transferable PCM
 // buffers and explicit release of the AudioBuffer avoid keeping both stages.
 const overhead=64*MiB+fileBytes,estimated=overhead+Math.max(length*channels*4+pcm+(stereo?analysis:0),pcm+analysis*(stereo?3:1)),budget=memoryBudget(capabilities);
 const bytesPerSecond=Math.max(sampleRate*(channels+retainedChannels)*4+(stereo?60*960*9:0),sampleRate*retainedChannels*4+60*960*9*(stereo?3:1));
 return {duration,estimated,budget,fits:estimated<=budget,maxMinutes:Math.max(0,Math.floor((budget-overhead)/bytesPerSecond/60))};
}
