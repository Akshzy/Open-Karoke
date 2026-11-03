import { describe, expect, it } from 'vitest';
import { mapMdxStemUrls, mobileSongLimitSeconds, separationRuntime } from './audio';

describe('MDX stem mapping', () => {
  it('maps the instrumental-primary karaoke model without swapping stems', () => {
    expect(mapMdxStemUrls(['derived-vocals', 'primary-instrumental'], 'instrumental')).toEqual({
      vocalsUrl: 'derived-vocals', instrumentalUrl: 'primary-instrumental',
    });
  });

  it('selects the primary vocal output from the optional vocal-focused model', () => {
    expect(mapMdxStemUrls(['derived-instrumental', 'primary-vocals'], 'vocals')).toEqual({
      instrumentalUrl: 'derived-instrumental', vocalsUrl: 'primary-vocals',
    });
  });
});

describe('mobile separation safety', () => {
  const navigatorStub = (mobile: boolean, deviceMemory?: number, webgpu = true) => ({
    userAgent: mobile ? 'Android Mobile' : 'Desktop',
    userAgentData: { mobile },
    deviceMemory,
    ...(webgpu ? { gpu: {} } : {}),
  }) as unknown as Navigator;

  it('uses WASM-only mode on mobile even when WebGPU is exposed', () => {
    expect(separationRuntime(navigatorStub(true, 4))).toEqual({ backend: 'WASM', executionProviders: ['wasm'] });
  });

  it('keeps WebGPU with a WASM fallback on desktop', () => {
    expect(separationRuntime(navigatorStub(false, 8))).toEqual({ backend: 'WebGPU', executionProviders: ['webgpu', 'wasm'] });
  });

  it('sets conservative duration limits from mobile memory hints', () => {
    expect(mobileSongLimitSeconds(navigatorStub(true, 2))).toBe(3 * 60);
    expect(mobileSongLimitSeconds(navigatorStub(true, 4))).toBe(5 * 60);
    expect(mobileSongLimitSeconds(navigatorStub(true, 8))).toBe(8 * 60);
    expect(mobileSongLimitSeconds(navigatorStub(false, 2))).toBe(15 * 60);
  });
});
