# ShowCQT Musical Detail Web

Static, client-side web application for converting MP3/WAV files into portable
Sonic Visualiser `.sv` sessions containing the Musical Detail v2
ShowCQT display.

## Pitch alignment

- Each of the 960 bins spans 10 octaves, from about 20 Hz to 20.5 kHz.
  Its displayed centre frequency follows the ShowCQT kernel, including the
  half-bin offset caused by averaging pairs of supersampled kernels.
- Note labels use the nearest 12-tone equal-tempered pitch with A4 = 440 Hz.
  This labels *frequency bins*, not automatically transcribed musical notes;
  overtones and simultaneous instruments may appear at other note positions.
- Display brightness now uses a strictly increasing soft compression instead
  of hard clipping and peak darkening. This keeps the brightest point of loud
  tones at the correct frequency bin across the full register. Run
  `pnpm test:pitch` to verify 120 semitones at five input levels.
- Sessions generated with v1 keep their earlier rendering. Analyse the audio
  again to obtain the v2 pitch-aligned output.

## Privacy and output

- Audio decoding, filtering, ShowCQT analysis, and bzip2 session generation run
  in the browser. Audio is not uploaded.
- The generated session contains the 960-bin analysis and references the
  original audio by filename. Keep the `.sv` next to the unmodified MP3/WAV
  when opening it in Sonic Visualiser. If prompted, locate the original audio.
- The session does not embed audio or expose an absolute path, so the pair of
  files can be moved between macOS and Windows.
- Sonic Visualiser opens the generated `.sv` directly, with Magma, smoothing,
  linear scale, no normalization, and note-name bins already configured.

## Local development

```sh
pnpm install
pnpm dev
```

## GitHub Pages

Run `pnpm build`, then publish the contents of `dist/`. The repository includes
a Pages workflow in `.github/workflows/static.yml`.

The ShowCQT engine is LGPL-3.0-or-later. See `public/COPYING` and
`public/COPYING.LESSER`. The bzip2 WebAssembly wrapper retains the original
bzip2 licence in `public/BZIP2-LICENSE.txt`.
