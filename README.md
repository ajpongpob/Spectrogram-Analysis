# ShowCQT Musical Detail Web

Static, client-side web application for converting MP3/WAV files into portable
Sonic Visualiser `.sv` sessions containing the validated Musical Detail v1
ShowCQT display.

## Privacy and output

- Audio decoding, filtering, ShowCQT analysis, and bzip2 session generation run
  in the browser. Audio is not uploaded.
- The generated session contains the 960-bin analysis but intentionally does
  not embed or reference the source audio. This makes it portable across macOS
  and Windows and avoids exposing a local absolute file path.
- Sonic Visualiser opens the generated `.sv` directly, with Magma, smoothing,
  linear scale, no normalization, and note-name bins already configured.

## Local development

```sh
pnpm install
pnpm dev
```

## GitHub Pages

Run `pnpm build`, then publish the contents of `dist/`. The repository includes
a Pages workflow in `.github/workflows/deploy-pages.yml`.

The ShowCQT engine is LGPL-3.0-or-later. See `public/COPYING` and
`public/COPYING.LESSER`. The bzip2 WebAssembly wrapper retains the original
bzip2 licence in `public/BZIP2-LICENSE.txt`.
