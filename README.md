# OpenKaraoke Studio

A free, open-source, mobile-first karaoke creator that runs entirely in the browser. Import a song you have the right to use, remove lead vocals locally, synchronize real LRC lyrics, preview the result, and export a standards-based MP4 or audio + LRC fallback.

## What is implemented

- Vite + React + TypeScript installable PWA, designed for phones first.
- Local vocal separation with `UVR-MDX-NET-Inst_HQ_3` through `web-audio-separation` and ONNX Runtime Web. This model targets a clean instrumental by removing lead and backing vocals. It is fetched from the browser-compatible source registered by that package, with byte progress, abort support, size validation, and Cache Storage persistence.
- Optional on-demand `Kim_Vocal_2` pass improves the isolated-vocal stem without replacing or recomputing the karaoke instrumental; its approximately 67 MB model is downloaded only when requested and cached locally.
- Optional review-first local lyric detection uses multilingual `whisper-tiny` through Transformers.js in a Web Worker. It never uploads audio or silently replaces editor lyrics; generated text/timestamps are explicitly labeled as a fallible draft.
- WebGPU preference with multithreaded WASM fallback when cross-origin isolation is active.
- One-time on-demand model download cached by Cache Storage; it is not part of the app bundle.
- MP3/WAV and browser-supported FLAC decoding with explicit errors; 15-minute safety limit.
- UTF-8 LRC import/paste/edit for Malayalam, Tamil, Hindi, English, and other Unicode scripts.
- LRCLIB title/artist lookup ranked against the original song duration, preferring Lyricsfile word sync and then synchronized LRC; ambiguous recordings remain user-selectable.
- Manual playhead timestamp capture and adjustable global lyric offset. Plain lyrics remain explicitly untimed. No generated/fabricated lyrics or timing.
- Synchronized player with seeking, current/next line, play/pause, and fullscreen.
- Real MP4 export using Mediabunny + WebCodecs: H.264 video, AAC audio, timed canvas-rendered lyrics, 720×1280 or 1280×720.
- Instrumental WAV, isolated-vocal WAV, and UTF-8 LRC downloads. The audio + LRC path is always offered when MP4 encoding is unsupported.
- Offline app-shell cache, on-demand model cache, and local persistence of project metadata/lyrics/settings.

## Privacy and networking

Song audio is read from a local object URL and never uploaded. The browser fetches the separation model from the `Blane187/all_public_uvr_models` Hugging Face repository used by `web-audio-separation`, and ONNX Runtime assets from jsDelivr; the model is cached locally. Lyric lookup is optional: when the user presses **Find synced lyrics**, only the entered title, artist, and original audio duration are sent directly from the browser to LRCLIB. There is no account, analytics, paid API, hosted inference, or required backend.

## Run locally

Node.js 20+ and pnpm are recommended.

```bash
pnpm install
pnpm dev
```

The dev and preview servers set COOP/COEP headers. These headers enable `SharedArrayBuffer` and multithreaded WASM, and must remain enabled in production.

Validation:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm preview
```

## Deploy on Vercel

1. Push this folder to a Git repository.
2. Import the repository in Vercel.
3. Keep the detected framework as Vite. `vercel.json` already sets `pnpm build`, `dist`, SPA rewrites, immutable asset caching, and the required cross-origin isolation/security headers.
4. Deploy. No environment variables, functions, database, or paid service are required.

CLI alternative:

```bash
pnpm dlx vercel
pnpm dlx vercel --prod
```

## Browser/device limits

- MP4 creation requires working WebCodecs H.264 and AAC encoders. The app tests both before enabling export and never labels an unsupported export successful.
- Separation is compute- and memory-heavy. WebGPU-capable desktop Chromium is the best case. CPU/WASM and phones can take many times the song duration; iOS may terminate a backgrounded tab. Keep the app foregrounded.
- The separator library reports progress but does not currently expose an interruptible inference signal. Cancel requests discard results at the next safe boundary; an in-flight model operation may finish first.
- Local Whisper lyric detection is a review-only draft: singing, accents, overlapping voices, and residual accompaniment can produce wrong words or approximate phrase timestamps. It never applies or exports the draft without an explicit user action.
- FLAC decoding depends on the browser. Use WAV or MP3 if it fails.
- Project text/settings persist locally. Large audio stems intentionally remain session-only to avoid silently consuming device storage.
- Indic export uses the device's native Noto/Nirmala/Latha/Mangal font stack and waits for `document.fonts.ready`. Verify the intended typeface/glyph coverage on the target device before distributing a video.
- A real phone was not available in this development environment; mobile layout is responsive but device performance and thermal behavior are unverified.

## Licensing and model provenance

The app is MIT. Mediabunny is MPL-2.0. The selected UVR/MDX-Net karaoke model is documented as MIT by its distributors and derives from Ultimate Vocal Remover / KUIELab MDX-Net. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) and keep notices intact when redistributing.

Only process and export audio and lyrics you have permission to use.
