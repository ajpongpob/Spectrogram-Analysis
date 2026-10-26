# MuSpec Lab V0.7

Browser-based 2D/3D audio analysis with shared editable annotations and clickable reference piano keys. The current web workspace is documented in [WEB-VIEWER.md](WEB-VIEWER.md); see [3D behavior and accuracy](docs/3D-VIEWER.md).

## Legacy Sonic Visualiser exporter

Static, client-side web application for converting MP3/WAV files into portable
Sonic Visualiser `.sv` sessions containing the Musical Detail v2.1
ShowCQT display.

## Pitch alignment

- Each of the 960 bins spans 10 octaves, from about 20 Hz to 20.5 kHz.
  Its displayed centre frequency follows the ShowCQT kernel, including the
  half-bin offset caused by averaging pairs of supersampled kernels.
- Axis labels use the nearest 12-tone equal-tempered pitch with A4 = 440 Hz,
  plus the cent offset. The arrow ↑ refers to the **upper tick** of the labelled
  interval, not the text's vertical centre. Sonic Visualiser merges scale cells
  when space is tight and otherwise centres the last bin's name below its tick,
  causing apparently shifted pitches. Explicit edge labels remain meaningful
  when the number of skipped cells changes. These label *axis frequencies*, not
  automatically transcribed musical notes;
  overtones and simultaneous instruments may appear at other note positions.
- Display brightness now uses a strictly increasing soft compression instead
  of hard clipping and peak darkening. This keeps the brightest point of loud
  tones at the correct frequency bin across the full register. Run
  `pnpm test:pitch` to verify 120 semitones at five input levels.
- Sessions generated with v1 keep their earlier rendering. Analyse the audio
  again to obtain the current output. v2 sessions also need regeneration for
  the v2.1 upper-tick labels; analysis intensities are unchanged from v2.
- The pure-tone test checks data peaks, not host label placement. v2.1 was also
  checked through native Sonic Visualiser PNG/SVG exports of G4, G#4 and A4
  at full range and at a one-octave vertical zoom.

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


## Licensing and academic use

Copyright © 2026 Pongpob Sukittiwong in **original MuSpec Lab materials**.
All rights reserved except as provided in [LICENSE](LICENSE): using the
unmodified official tool for non-commercial educational and academic research
purposes is allowed **only with attribution for every use**, including
unpublished classroom, teaching, learning, research and analysis activities.
Record the attribution in the relevant teaching material, research notes,
analysis records or publication as applicable; generated figures and research
outputs may be published academically with citation. Unauthorized commercial use,
reproduction, redistribution or modification of the original MuSpec Lab
source/interface requires advance written permission.

**Third-party rights are not restricted:** ShowCQT/showcqt-js and its JS/WASM
files remain under LGPL-3.0-or-later and may be used, modified and shared
subject to that license. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md),
`public/COPYING`, `public/COPYING.LESSER`, and `public/BZIP2-LICENSE.txt`.

Website terms (Thai and English):
https://ajpongpob.github.io/Spectrogram-Analysis/license.html

Recommended citation: Sukittiwong, P. (2026). *MuSpec Lab* (v1.0.0)
[Web application]. https://ajpongpob.github.io/Spectrogram-Analysis/
