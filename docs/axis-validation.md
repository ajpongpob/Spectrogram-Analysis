# v2.1 axis validation

The 600 pure-tone checks validate analysis bins. They do not validate the
position where a host application paints text.

Sonic Visualiser's `Colour3DPlotLayer::paintVerticalScale` skips cells when
labels would overlap. For a displayed tick at bin boundary `i`, it uses the
name of bin `i - 1`, centred in the interval below the tick. That interval
may contain several data bins. The earlier nearest-note names were therefore
misleading when interpreted at the text's centre.

Source: https://github.com/sonic-visualiser/svgui/blob/default/layer/Colour3DPlotLayer.cpp

v2.1 labels that upper boundary explicitly with an upward arrow and a cent
offset. For example, `↑ G4 +25c` describes the tick above the text. The text
itself is still positioned by Sonic Visualiser. No frequency bins or analysis
values are moved. The bin centre is half a bin (6.25 cents) below its upper
boundary at the current 960-bin resolution.

## Checks

- `pnpm test:pitch`: 600 sine-tone data checks and upper-edge reference labels
  from E0 through C10, including G4, G#4 and A4 and four cent-offset checks.
- End-to-end browser export: a six-second, 44.1 kHz mono WAV containing
  G4 (391.99543598 Hz), G#4 (415.30469758 Hz) and A4 (440 Hz), two seconds each,
  with peak sample amplitude 0.4.
- Opened that exported session in Sonic Visualiser 5.2.1 on macOS and exported
  PNG and SVG using its supported `--osc-script` interface, at full range
  and vertical bin extents 360–456. Visually checked the three ridges against
  the upper ticks.

These are bounded checks on the stated host and signals, not a claim of
sub-cent pitch-estimation accuracy or automatic melody transcription.
