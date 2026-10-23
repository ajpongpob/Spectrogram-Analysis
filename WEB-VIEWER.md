# Web Viewer 0.6

Drop an MP3 or WAV into the main page to analyse and explore it in the browser.
The worker returns transferable Float32 CQT data directly to the viewer. Audio
is decoded at 44.1 kHz; no upload endpoint is used. Annotations are stored locally
under the SHA-256 of the selected file. The original .sv exporter is at legacy.html.

Build with `npm install` and `npm run build`. GitHub Pages publishes the tracked
dist directory through the existing workflow. No user audio belongs in dist.

Validation: `npm run test:pitch` checks the analysis engine. For browser integration,
serve dist on localhost:8954 and run `node tests/web-viewer.mjs` with WAV_FIXTURE
pointing to a six-second mono WAV (G4, G#4, A4, two seconds each), and MP3_FIXTURE
pointing to the Rosanna reference track. TEST_URL can target a deployed site.
The integration script uses installed Chrome on macOS and writes test-results.
Reference recordings are not included in the repository.

Browser checks cover actual WAV/MP3 analysis, pitch, playback, annotation, PNG
clipboard, cancellation, bad-file recovery, and absence of POST upload requests.
