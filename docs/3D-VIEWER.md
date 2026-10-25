# MuSpec Lab V0.7 — 2D / 3D display

Select an MP3/WAV once. The analysis opens in 2D by default. The tabs above the controls switch between the original spectrogram and the 3D surface without decoding or analysing the audio again.

Both modes share the same audio element, playback position, time/pitch window, palette, brightness, axis units and time format. Switching tabs does not pause playback. Both modes share annotation objects, selection, editing, clipboard, undo/redo and local persistence. Switching modes returns the pointer tool to Pan view.

3D tools: orbit 360 degrees, tilt, height multiplier, reset/top view, playback/seek/follow, and PNG export. Click the visible surface to seek without changing the view, as in 2D. With Pan view selected, left-drag pans time/pitch and Shift+drag orbits. Wheel zooms time at the pointer, Ctrl+wheel zooms pitch at the pointer, Alt+wheel zooms the fitted view. Space toggles playback when focus is not in an editable control. Escape cancels a drag. Shared controls remain above the active view.

Cursor picking intersects the visible projected mesh triangles and selects the front-most hit with perspective correction. Empty-space clicks do not seek. Picking precision is limited by the preview mesh; use 2D for exact onset/pitch work. Pan is disabled at near-edge-on camera angles where mapping would be unstable; tilt toward the top view to pan.

The default CQT height is a ShowCQT visualization value (the green channel after gain and square-root compression), not linear physical intensity, dB or perceived loudness. Its fixed 0–3 scale clips values above 3 and reports the clipped mesh count. The display mesh uses maxima over 160×320 cells for responsiveness; exact note/onset work should use 2D. Underlying 960-bin/60-fps analysis data is unchanged. Grid lines remain on the base plane and draw through the surface as a visible overlay. The playhead is drawn as a visible overlay.

WebGL is initialized only on first selecting 3D. If unavailable, an error is shown and 2D remains available. Rectangular clipboard capture remains 2D-only. The 3D PNG export includes annotations without selection handles.

Both modes offer Full screen above the plot, with Exit full screen and Escape to return. Browsers without native fullscreen expand the plot within the browser. The 3D scene automatically fits and centers inside the available frame, including after resizing or entering fullscreen. This view transform preserves data coordinates, height calculations, and cursor picking.

The Axes & grid section lets users place the pitch axis on the left or right projected edge. Its piano keys follow the visible pitch range, with note names or Hz matching the shared axis setting. Labels are spaced to avoid overlap.

## Annotation geometry and reference piano

Text, arrows, double arrows, lines, highlights, rectangles, ellipses and triangles share the 2D object renderer. In 3D, the first click intersects the front-most visible triangle (or the graph base plane). Drawing continues on the constant-intensity plane through that first anchor. Objects store time, pitch and optional intensity anchors; camera rotation, display zoom, and height changes reproject them without modifying analysis data. Shapes and text face the screen for legibility. Existing 2D objects without an intensity anchor attach to the interpolated visible mesh. Moving objects preserves their stored intensity anchors. Shift constrains a circle/square in the current screen view; subsequent view changes can change its screen aspect.

Piano keys in either view play a synthesized piano-like reference voice at the exact equal-tempered note and octave, A4 = 440 Hz. A click does not seek or create an annotation. Harmonics above the output Nyquist limit are omitted, voices decay automatically, and polyphony is bounded. This is a tuning reference, not an acoustic-piano sample library.

## V0.7 accuracy review

- Cursor rays use perspective-correct, nearest-triangle intersections. Dragging now uses the exact inverse projection of the anchor plane rather than a local derivative. The frame remains fixed while panning and refits at release.
- Max-aggregated cells retain both their winning source bin and source frame. Peak emphasis now reads the mask at that exact source sample; previously it could use the cell midpoint frame.
- Pitch, height clipping, original palette formulas and CQT processing remain unchanged. The 160×320 maximum-aggregation preview is not additional analysis resolution. At a full 120-semitone view, each mesh cell spans 0.375 semitones; its represented peak may lie within that cell rather than exactly at its displayed center.
- Unit tests cover 4,314 inverse projections across camera angles, distances, heights and aspect ratios; front-most depth; triangle-height interpolation; winning source-frame selection; and CQT immutability.
- The existing pitch calibration passes 600 pure tones (MIDI 16–135 at five amplitudes). Browser tests analyse three known registers, test seeking at four camera settings, render the reference synth and check its fundamental against adjacent semitones in five registers, and exercise annotation editing/export/persistence in 3D.

## CQT / dBFS display scale

Axes & grid → Signal level scale switches both views between CQT and dBFS. The 2D frequency axis remains pitch/Hz; signal level is encoded by color with a labeled color bar. 3D uses the same dB color mapping and a dB height axis. Display ranges are −60, −90 (default), or −120 to 0 dBFS. Values outside the range saturate only the drawing; sample values and hover measurements are retained. No file/window peak normalization is applied.

CQT preserves the previous filter, ShowCQT green values, colors, visual gain and peak emphasis. dBFS is a separate, unfiltered CQT analysis of the decoded PCM using the same kernel. Each of the 960 bins is referenced to equal-channel, bin-centered, half-scale sines, with sine/cosine powers averaged to reduce phase bias. Since green is the square root of spectral amplitude times visual gain, the recovered amplitude is `0.5 × (green / calibrationGreen)²`; the displayed level is `20 log10(amplitude)`. The reference represents a peak-amplitude-one sine as 0 dBFS, with stereo channels combined by mean energy. A tone in only one channel reads approximately 3.01 dB lower than the same tone in both channels.

This is a calibrated per-band sine-equivalent digital spectral level, not dB SPL, broadband RMS, PSD, or perceived loudness. Finite CQT windows cause phase/frequency-dependent errors; off-center tones and transients need not match a stationary bin-centered reference. Tests across all 960 bins, four phases and four amplitudes (15,360 cases) found a maximum 0.174 dB error for the tested stationary bin-centered tones. Silence is −∞ in measurements and maps to the display floor.

Visual gain and peak emphasis are disabled only in dB mode so they cannot alter the calibrated scale; prior CQT settings are restored on return. Both modes retain the palette hues. Annotation height anchors record their originating scale; on the other scale they reattach at the corresponding time/pitch on its mesh. Switching scales does not rewrite saved annotations. Worker memory estimates include the additional amplitude matrix and unfiltered/filtered audio buffers.

Validation: `pnpm test:db` checks calibration, phase, stereo and silence; `pnpm test:levels` exercises actual WAV analysis, CQT pixel round trips, fixed measurements under zoom/range changes, dB 3D picking/annotations/PNG, the 2D color legend, language, fullscreen and desktop layouts.
