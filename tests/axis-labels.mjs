import assert from 'node:assert/strict';
import { binAxisLabel } from '../src/pitch-axis.mjs';

// Independent reference points on the upper-edge grid: MIDI starts at
// 15.5 and there are eight cells per semitone.
for (const [bin, label] of [
  [3, 'E0'], [67, 'C1'], [163, 'C2'], [259, 'C3'], [355, 'C4'],
  [411, 'G4'], [419, 'G#4'], [427, 'A4'],
  [451, 'C5'], [547, 'C6'], [643, 'C7'], [739, 'C8'],
  [835, 'C9'], [931, 'C10']
]) {
  assert.equal(binAxisLabel(bin), `↑ ${label}`);
}
assert.equal(binAxisLabel(410), '↑ G4 -12.5c');
assert.equal(binAxisLabel(412), '↑ G4 +12.5c');
assert.equal(binAxisLabel(415), '↑ G#4 -50c');
assert.equal(binAxisLabel(426), '↑ A4 -12.5c');
console.log('Upper-tick labels passed: 14 note anchors across ten octaves and four cent offsets');
