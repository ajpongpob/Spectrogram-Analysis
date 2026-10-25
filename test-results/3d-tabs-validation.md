# 2D/3D integration validation — 2026-10-25

Tested the production build on localhost:8957 in the in-app browser.

- Rosanna MP3 (5:29) analysed to 100%; default selected tab was 2D.
- Seeked to 20 seconds in 2D, switched to 3D: same position/window, no second file selection or analysis.
- 3D hid annotation, crop and 2D gesture tools; retained common display settings.
- Changed palette to Viridis, started audio in 3D and returned to 2D during playback. Audio continued beyond 28 seconds and the palette persisted.
- 2D annotation/crop tools reappeared; switching back restored 3D controls and current position.
- Follow playback advanced the visible time window.
- No captured browser console errors.
- Mathematical mesh/height tests, 600-tone pitch calibration, axis label and reference-color tests passed.

Not a cross-browser or performance certification. 3D annotations/rectangular clipboard selection are not supported; those tools intentionally remain 2D-only.
