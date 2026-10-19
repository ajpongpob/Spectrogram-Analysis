import assert from 'node:assert/strict';
import ShowCQT from '../src/showcqt/showcqt-main.mjs';
import { binFrequency, displayIntensity, highFrequencyBlend, nearestMidi, noteName } from '../src/pitch-axis.mjs';

const rate = 44100;
const width = 960;
const cqt = await ShowCQT.instantiate();
cqt.init(rate, width, 1, 4, 4, 4);
cqt.set_volume(19, 10);
const blend = Float32Array.from({ length: width }, (_, bin) => highFrequencyBlend(binFrequency(bin, width)));
const amplitudes = [0.4, 0.02, 0.002, 0.0002, 0.00002];
let checked = 0;

for (const amplitude of amplitudes) {
  for (let midi = 16; midi <= 135; midi++) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (let sample = 0; sample < cqt.fft_size; sample++) {
      const value = amplitude * Math.sin(2 * Math.PI * frequency * sample / rate);
      cqt.inputs[0][sample] = value;
      cqt.inputs[1][sample] = value;
    }
    cqt.calc();
    let brightestBin = 0;
    let brightestValue = -1;
    for (let bin = 0; bin < width; bin++) {
      const value = displayIntensity(cqt.color[4 * bin + 1], blend[bin]);
      if (value > brightestValue) {
        brightestValue = value;
        brightestBin = bin;
      }
    }
    assert.equal(
      nearestMidi(binFrequency(brightestBin, width)), midi,
      `${noteName(frequency)} at ${frequency.toFixed(2)} Hz and amplitude ${amplitude} peaked at bin ${brightestBin}`
    );
    checked++;
  }
}

console.log(`Pitch alignment passed: ${checked} pure tones, MIDI 16–135, five amplitudes`);
