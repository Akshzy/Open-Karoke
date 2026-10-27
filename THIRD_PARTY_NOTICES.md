# Third-party notices

OpenKaraoke Studio is MIT-licensed. The following software and model are used without modification unless stated otherwise.

| Component | Purpose | License / source |
|---|---|---|
| `web-audio-separation` | Browser MDX separation pipeline | MIT, incidentist/web-audio-separation |
| ONNX Runtime Web | WebGPU and WASM inference | MIT, Microsoft/onnxruntime |
| `UVR-MDX-NET-Inst_HQ_3` model | Lead- and backing-vocal removal | MIT; Ultimate Vocal Remover / KUIELab MDX-Net lineage. Fetched from the `Blane187/all_public_uvr_models` source registered by `web-audio-separation`. |
| Mediabunny | WebCodecs encoding and MP4 muxing | MPL-2.0, Vanilagy/mediabunny |
| LRCLIB | Optional synchronized-lyrics lookup API | Free public service and open-source server (AGPL-3.0), tranxuanthang/lrclib; lyric rights remain with their respective owners |
| Lyricsfile specification | Word-level lyric timing format | CC0-1.0, tranxuanthang/lyricsfile |
| React | Interface | MIT, Meta |
| Vite and vite-plugin-pwa / Workbox | Build and offline service worker | MIT |

## Reference implementation reviewed

The architecture and browser constraints were checked against `Gerschwin/steminize` (MIT, copyright 2026 Neil). This project does not copy Steminize UI code. It follows its validated browser practices: local inference, WebGPU with WASM fallback, COOP/COEP isolation headers, model caching, and honest memory constraints.

The complete dependency tree and exact package versions are recorded in `pnpm-lock.yaml`. Preserve this file and all package license files when redistributing.
