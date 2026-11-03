# Contributing to OpenKaraoke Studio

Thank you for helping make private, local karaoke creation more reliable.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

Keep changes focused. Audio must remain local, optional network requests must be disclosed, and unsupported processing/export paths must return honest errors rather than simulated success.

## Bug reports

Please include:

- Browser name and version
- Operating system/device model
- Approximate RAM, when known
- Audio format, duration and file size (do not upload copyrighted audio)
- The exact workflow step and visible message
- Whether the tab crashed, returned an app error, or completed incorrectly

## Device reports

Mobile separation is especially dependent on browser memory limits. A useful report includes:

```text
Device:
Browser/version:
RAM (if known):
Song format / duration / size:
Separation result:
Approximate processing time:
MP4 export result:
```

Use audio you have permission to process. Share generated diagnostics or a reproducible synthetic sample instead of copyrighted songs.

## Pull requests

- Preserve the three-step workflow and existing architecture.
- Add focused tests for behavioral changes.
- Run tests, typecheck and production build.
- Do not add paid services, mandatory accounts or server-side audio processing.
- Preserve third-party licenses and update notices when dependencies or models change.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
