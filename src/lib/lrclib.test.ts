import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAmbiguousMatch, lyricsFromRecord, parseLyricsfile, rankLyricsCandidates, searchLrclib, type LrclibRecord } from './lrclib';

const base: LrclibRecord = {
  id: 1,
  trackName: 'മലയാളം പാട്ട്',
  artistName: 'ഗായകൻ',
  albumName: 'Album',
  duration: 180,
  instrumental: false,
  hasWordSync: false,
  plainLyrics: 'വരി ഒന്ന്',
  syncedLyrics: '[00:01.25]വരി ഒന്ന്',
  lyricsfile: "version: '1.0'\nmetadata:\n  title: 'മലയാളം പാട്ട്'\n",
};

describe('LRCLIB integration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses word timing in milliseconds and preserves Unicode and whitespace', () => {
    const lines = parseLyricsfile(`version: '1.0'
metadata:
  title: 'Test'
lines:
  - text: 'வணக்கம் உலகம்'
    start_ms: 1250
    end_ms: 3000
    words:
      - text: 'வணக்கம் '
        start_ms: 1250
        end_ms: 2100
      - text: 'உலகம்'
        start_ms: 2100
        end_ms: 3000
plain: |
  வணக்கம் உலகம்`, 42);
    expect(lines[0]).toMatchObject({ id: 'lrclib-42-0', time: 1.25, endTime: 3, text: 'வணக்கம் உலகம்' });
    expect(lines[0].words).toEqual([
      { text: 'வணக்கம் ', startTime: 1.25, endTime: 2.1 },
      { text: 'உலகம்', startTime: 2.1, endTime: 3 },
    ]);
  });

  it('does not import empty Lyricsfile gap markers as editable lyric rows', () => {
    const lines = parseLyricsfile(`version: '1.0'
lines:
  - text: 'வரி'
    start_ms: 500
    end_ms: 1500
  - text: ''
    start_ms: 1500
    end_ms: 2500
  - text: 'அடுத்த வரி'
    start_ms: 2500`, 7);
    expect(lines.map((line) => line.text)).toEqual(['வரி', 'அடுத்த வரி']);
  });

  it('prioritizes title, artist, original duration, and word sync', () => {
    const ranked = rankLyricsCandidates([
      { ...base, id: 2, duration: 215, hasWordSync: true },
      { ...base, id: 3, duration: 181, hasWordSync: true },
      { ...base, id: 4, trackName: 'Different', artistName: 'Someone', duration: 180 },
    ], base.trackName, base.artistName, 180);
    expect(ranked[0].id).toBe(3);
    expect(ranked[0].syncKind).toBe('word');
    expect(isAmbiguousMatch(ranked)).toBe(false);
  });

  it('uses title, artist, and original duration for exact lookup before ranked search', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input); calls.push(url);
      return new Response(JSON.stringify(url.includes('/api/get?') ? base : [base]), { status: 200 });
    }));
    const result = await searchLrclib(base.trackName, base.artistName, 180);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/api/get?');
    expect(calls[0]).toContain('duration=180');
    expect(new URL(calls[0]).searchParams.get('track_name')).toBe(base.trackName);
    expect(result).toHaveLength(1);
  });

  it('broadens from an exact miss to artist search, then title-only search', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input); calls.push(url);
      if (url.includes('/api/get?')) return new Response('{}', { status: 404 });
      if (url.includes('artist_name=')) return new Response('[]', { status: 200 });
      return new Response(JSON.stringify([base]), { status: 200 });
    }));
    const result = await searchLrclib(base.trackName, base.artistName, 180);
    expect(calls).toHaveLength(3);
    expect(calls[1]).toContain('artist_name=');
    expect(calls[2]).not.toContain('artist_name=');
    expect(result[0].id).toBe(base.id);
  });

  it('falls back to a title-only search when artist metadata is unavailable', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify([base]), { status: 200 });
    }));
    const result = await searchLrclib(base.trackName, '', 180);
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain('artist_name=');
    expect(result[0].id).toBe(base.id);
  });

  it('returns an empty result and retries transient LRCLIB overload twice', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    await expect(searchLrclib('Missing song', '', 100)).resolves.toEqual([]);
    const overloaded = vi.fn(async () => new Response('{}', { status: 503, headers: { 'Retry-After': '0' } }));
    vi.stubGlobal('fetch', overloaded);
    await expect(searchLrclib('Unavailable song', '', 100)).rejects.toThrow('LRCLIB is temporarily overloaded');
    expect(overloaded).toHaveBeenCalledTimes(3);
  });

  it('retries all server errors, including the observed 505 response', async () => {
    const unavailable = vi.fn(async () => new Response('{}', { status: 505, headers: { 'Retry-After': '0' } }));
    vi.stubGlobal('fetch', unavailable);
    await expect(searchLrclib('Unavailable song', '', 100)).rejects.toThrow('LRCLIB is temporarily overloaded');
    expect(unavailable).toHaveBeenCalledTimes(3);
  });

  it('uses a cached successful search when LRCLIB is temporarily unavailable', async () => {
    const cached = new Response(JSON.stringify([base]), { status: 200 });
    vi.stubGlobal('caches', { open: vi.fn(async () => ({ match: vi.fn(async () => cached.clone()) })) });
    const unavailable = vi.fn(async () => new Response('{}', { status: 503, headers: { 'Retry-After': '0' } }));
    vi.stubGlobal('fetch', unavailable);
    const result = await searchLrclib(base.trackName, '', base.duration);
    expect(result[0].id).toBe(base.id);
    expect(unavailable).toHaveBeenCalledTimes(3);
  });

  it('stores a usable copy of successful results before the caller consumes the response', async () => {
    const put = vi.fn(async (_url: string, _response: Response) => undefined);
    vi.stubGlobal('caches', { open: vi.fn(async () => ({ put, keys: vi.fn(async () => []), delete: vi.fn() })) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([base]), { status: 200 })));
    const result = await searchLrclib(base.trackName, '', base.duration);
    expect(result[0].id).toBe(base.id);
    await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
    const stored = put.mock.calls[0][1] as Response;
    await expect(stored.json()).resolves.toEqual([base]);
  });

  it('prefers Lyricsfile word sync, then LRC, and leaves plain lyrics untimed', () => {
    const word = lyricsFromRecord({ ...base, hasWordSync: true, lyricsfile: `version: '1.0'\nlines:\n  - text: 'नमस्ते'\n    start_ms: 500\n    words:\n      - text: 'नमस्ते'\n        start_ms: 500\n        end_ms: 1000` });
    expect(word.kind).toBe('word');
    expect(word.lines[0].words?.[0].startTime).toBe(0.5);

    expect(lyricsFromRecord(base).kind).toBe('line');
    const plain = lyricsFromRecord({ ...base, syncedLyrics: null });
    expect(plain.kind).toBe('plain');
    expect(plain.lines[0]).toMatchObject({ text: 'വരി ഒന്ന്', timed: false });
  });
});
