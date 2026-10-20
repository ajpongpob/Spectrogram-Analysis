// Match the ShowCQT kernel's logarithmic range and two-times supersampling.
// The engine averages pairs of kernels, so each displayed bin is centred at
// low * 2 ** ((bin + 0.5) / 96) when the output width is 960.
export const LOW_FREQUENCY = 20.015231264080075;
export const OCTAVES = 10;
export const REFERENCE_A4 = 440;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function binFrequency(bin, width = 960) {
  return LOW_FREQUENCY * 2 ** (OCTAVES * (bin + 0.5) / width);
}

export function nearestMidi(frequency) {
  return Math.floor(69 + 12 * Math.log2(frequency / REFERENCE_A4) + 0.5);
}

export function noteName(frequency) {
  const midi = nearestMidi(frequency);
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// Colour3DPlotLayer may skip bins when drawing its scale. It labels a merged
// interval with bin i-1, but centres that label below the tick for bin i.
// Label the upper edge explicitly: this stays true at every merge interval.
export function binAxisLabel(bin, width = 960) {
  const hz = binFrequency(bin + 0.5, width);
  const pitch = 69 + 12 * Math.log2(hz / REFERENCE_A4);
  const midi = Math.floor(pitch + 0.5 + 1e-9);
  const cents = Math.round((pitch - midi) * 1000) / 10;
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  return `↑ ${name}${Math.abs(cents) < 0.01 ? '' : ` ${cents > 0 ? '+' : ''}${cents}c`}`;
}

export function highFrequencyBlend(frequency) {
  return Math.max(0, Math.min(1, Math.log2(frequency / 1000) / 2));
}

export function displayIntensity(raw, blend) {
  // A hard clamp at 1 produced flat-topped peaks and placed loud notes on
  // neighbouring bins. Soft compression keeps their frequency order intact.
  const x = 1 - Math.exp(-Math.max(0, raw));
  return x * (1 - blend) + x ** 1.35 * blend;
}
