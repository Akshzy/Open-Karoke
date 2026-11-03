import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureKaraokeModel, ensureVocalModel, KARAOKE_MODEL_URL, VOCAL_MODEL_URL } from './modelCache';

afterEach(() => vi.unstubAllGlobals());

describe('karaoke model cache', () => {
  it('uses a complete cached model without making a network request', async () => {
    const match = vi.fn().mockResolvedValue(new Response(null, { headers: { 'content-length': String(50 * 1024 * 1024) } }));
    const fetchMock = vi.fn();
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match, delete: vi.fn(), put: vi.fn() }) });
    vi.stubGlobal('fetch', fetchMock);
    const updates: Array<{ cached: boolean }> = [];

    const model = await ensureKaraokeModel((progress) => updates.push(progress));

    expect(match).toHaveBeenCalledWith(KARAOKE_MODEL_URL);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updates.at(-1)?.cached).toBe(true);
    expect(model.url).toMatch(/^blob:/);
    model.release();
  });

  it('caches the optional vocal-focused model independently', async () => {
    const match = vi.fn().mockResolvedValue(new Response(null, { headers: { 'content-length': String(66_759_214) } }));
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match, delete: vi.fn(), put: vi.fn() }) });
    vi.stubGlobal('fetch', vi.fn());
    const model = await ensureVocalModel(() => undefined);
    expect(match).toHaveBeenCalledWith(VOCAL_MODEL_URL);
    expect(VOCAL_MODEL_URL).not.toBe(KARAOKE_MODEL_URL);
    model.release();
  });

  it('rejects and removes an incomplete streamed network response', async () => {
    const put = vi.fn();
    const deleteCached = vi.fn();
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match: vi.fn(), delete: deleteCached, put }) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([8, 1, 2, 3]), {
      status: 200,
      headers: { 'content-length': '4' },
    })));

    await expect(ensureKaraokeModel(() => undefined)).rejects.toThrow('incomplete');
    expect(put).toHaveBeenCalledOnce();
    expect(deleteCached).toHaveBeenCalledWith(KARAOKE_MODEL_URL);
  });
});
