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
