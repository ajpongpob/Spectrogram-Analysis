# MuSpec Lab v1.0.1

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

## Desktop annotation controls

The right sidebar expands one category inline beneath its heading. The active category stays open while working on the plot; selecting another heading switches the visible section.

- Stroke width: 0.25–48 px, in 0.25 px steps, using the slider or number field. New highlights use the displayed pixel width; previously saved highlights retain their appearance.
- Text: choose “แทรกข้อความ”, enter up to 240 characters (including multiple lines), choose a color and an 8–96 px font size, then click the plot. Text follows its time/pitch anchor, supports undo/redo and local persistence, and is included in PNG exports.
- Aurora and Graphite are display names for the existing reference and grayscale palettes. Their color mappings and CQT data are unchanged.

With the development server running, `pnpm test:annotations` verifies the browser interactions, persistence and exported PNG content at three desktop sizes. Set `TEST_URL` or `CHROME_PATH` to test another deployment or Chrome installation.

## Object editing, language and compact workspace

- Open Annotate and use Select / move. Click an object to select it, drag to move, or use Copy, Paste and Delete. New annotations become selected automatically. Text, color and stroke/text size can be edited on the selected object. Eight color presets sit beside the custom picker.
- ⌘/Ctrl+C and V copy/paste objects within the app; Delete/Backspace removes the selected object. ⌘/Ctrl+Z, Shift+Z (or Ctrl+Y) undo and redo. Native editing shortcuts remain available in text and number fields. The object clipboard stays within the current browser tab and works across files.
- EN/TH switches the interface live without re-analysis and remembers the choice. The landing page and viewer stay synchronized. Annotation text is preserved as written. Prepared PNG exports remain available after changing language.
- The landing page and workbench now use compact controls, inline tool sections and collapsible guidance. Playback, seeking and zoom are shared between 2D and 3D.
- 3D time/note grids draw through the surface as an overlay. The surface retains depth testing, and the CQT data, height and palette calculations are unchanged.

`pnpm test:objects` covers geometry, validation and legacy highlights. With a server running, `pnpm test:workspace` exercises object editing, bilingual controls, four desktop widths, export and persistence, and checks actual 3D grid pixels. Both browser suites support `TEST_URL` and `CHROME_PATH`.

## Shapes and full screen

- Annotation shapes include a single arrow, double arrow, circle/ellipse, triangle, rectangle and line. Hold Shift while drawing an ellipse or rectangle for a circle or square. Shapes use the existing object selection, movement, copy/paste, delete, undo/redo, local persistence and PNG export.
- Full screen is available beside the quick zoom buttons for both 2D and 3D. Exit with the visible button or Escape; unsupported browsers use an expanded browser view.
- 3D automatically fits the scene to its frame and supports a left/right piano axis, with note/Hz labels spaced to avoid collisions. Alt+wheel adjusts the display zoom.

With the built site served locally, `pnpm test:shapes` checks new shape creation and editing, Shift-constrained circles, export, persistence, native/fallback fullscreen, pitch-axis placement and accurate picking on the fitted 3D scene.

## V0.7

The Axes & grid section contains 3D pitch-axis placement. Annotate now works in both 2D and 3D with shared objects, history and persistence. 3D objects retain time/pitch and drawing-plane intensity anchors; PNG exports include them. Clicking piano keys in either mode plays an equal-tempered, synthesized piano-like reference tone for that register, without changing playback position. The landing page and workspace display the current release version.

`pnpm test:v07` exercises these features, the actual analysis worker at three reference pitches, projection/picking across camera settings, browser audio waveforms, fullscreen, and export pixels. See `docs/3D-VIEWER.md` for annotation geometry and the accuracy review.

## Signal level scales

Choose **CQT** or **dBFS** under **Axes & grid → Signal level scale**. The selection applies to both 2D and 3D. dBFS adds a 2D color scale and a 3D height scale with a configurable display floor. It uses an independent, unfiltered, per-bin sine-calibrated analysis with a fixed digital reference; it is not dB SPL. CQT data and rendering remain available unchanged. Details and measurement limits are in `docs/3D-VIEWER.md`.

## 1D frequency slice (v1.0.1)

The view tabs are ordered 1D, 2D, 3D; 2D remains the initial view. All three use the same analysis matrices, audio player, time cursor, frequency range and palette. Point at the 2D plot or a visible 3D surface point, then switch to 1D to inspect that time. 3D picking uses the existing perspective-correct surface intersection. Entering 1D pauses playback and chooses the nearest available 60 fps frame (at most 8.33 ms from an interior time; clamped at the recording boundaries). Without a selected point, the current playback time is used.

1D supports CQT and calibrated per-band dBFS, the five existing palettes, logarithmic/linear frequency axes, previous/next frame, numeric time entry, spectral peak readouts, playback, fullscreen, PNG and 960-bin CSV export. The audio window and spectral resolution are those of ShowCQT; a time slice does not imply sample-level temporal resolution. Peak note labels are nearest-note references, not polyphonic transcription. Existing annotations remain available in 2D/3D.

Run `pnpm test:1d` for nearest-frame boundaries, known tone bins, CQT/dBFS conversion, silence and source-array immutability. `pnpm test:3d`, `pnpm test:db` and `pnpm test:reference` cover unchanged picking, calibration and palette behavior. The local browser review uses generated 220/440/880 Hz WAV audio; temporary review pages are excluded from the deployment.
