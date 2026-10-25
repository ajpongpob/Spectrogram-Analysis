# 2D / 3D display tabs

Select an MP3/WAV once. The analysis opens in 2D by default. The tabs above the controls switch between the original spectrogram and the 3D surface without decoding or analysing the audio again.

Both modes share the same audio element, playback position, time/pitch window, palette, brightness, axis units and time format. Switching tabs does not pause playback. 2D annotation and selection tools are hidden in 3D and restored on return; existing annotations remain in memory.

3D tools: orbit 360 degrees, tilt, height multiplier, reset/top view, playback/seek/follow, and PNG export. Drag to orbit; wheel zooms time, Ctrl+wheel zooms pitch, Alt+wheel changes camera distance. Space toggles playback when focus is not in an editable control. Shared controls remain above the active view.

3D height is raw ShowCQT intensity, not dB or perceived loudness. The fixed 0–3 scale clips values above 3 and reports the clipped mesh count. The display mesh uses maxima over 160×320 cells for responsiveness; exact note/onset work should use 2D. Underlying 960-bin/60-fps analysis data is unchanged. Grid lines are on the base plane and can be occluded by the surface. The playhead is drawn as a visible overlay.

WebGL is initialized only on first selecting 3D. If unavailable, an error is shown and 2D remains available. Drawing annotations and rectangular clipboard capture remain 2D-only.
