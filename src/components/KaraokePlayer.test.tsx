import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { lyricsFromRecord, searchLrclib, type LrclibRecord } from '../lib/lrclib';
import { KaraokePlayer } from './KaraokePlayer';
import { LyricsEditor } from './LyricsEditor';

describe('lyrics state propagation', () => {
  it('shows an honest empty state instead of calling it an instrumental intro', () => {
    const markup = renderToStaticMarkup(<KaraokePlayer audioUrl="blob:test" title="Empty" lines={[]} offset={0} onOffset={() => undefined} />);
    expect(markup).toContain('No lyrics loaded');
    expect(markup).not.toContain('Instrumental intro');
  });

  it('keeps karaoke lyrics on the instrumental preview and labels the isolated vocal preview', () => {
    const lines = [{ id: 'one', time: 0, text: 'മോഹജാലകം' }];
    const karaoke = renderToStaticMarkup(<KaraokePlayer audioUrl="blob:instrumental" title="Song" lines={lines} offset={0} onOffset={() => undefined} />);
    const vocals = renderToStaticMarkup(<KaraokePlayer audioUrl="blob:vocals" title="Song" lines={lines} offset={0} onOffset={() => undefined} variant="vocals" />);
    expect(karaoke).toContain('മോഹജാലകം');
    expect(karaoke).toContain('Lyric offset');
    expect(vocals).toContain('Isolated vocals preview');
    expect(vocals).not.toContain('മോഹജാലകം');
    expect(vocals).not.toContain('Lyric offset');
  });

  it('carries a selected synchronized search result into visible Unicode player output', async () => {
    const record: LrclibRecord = {
      id: 9, trackName: 'தமிழ் பாடல்', artistName: 'கலைஞர்', albumName: 'Album', duration: 120,
      instrumental: false, hasWordSync: false, plainLyrics: 'வணக்கம் உலகம்',
      syncedLyrics: '[00:00.00]வணக்கம் உலகம்', lyricsfile: "version: '1.0'",
    };
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) =>
      new Response(JSON.stringify(String(input).includes('/api/get?') ? record : [record]), { status: 200 })));
    const results = await searchLrclib(record.trackName, record.artistName, record.duration);
    const selected = lyricsFromRecord(results[0]);
    const markup = renderToStaticMarkup(<KaraokePlayer audioUrl="blob:test" title={record.trackName} lines={selected.lines} offset={0} onOffset={() => undefined} />);
    expect(selected.kind).toBe('line');
    expect(markup).toContain('வணக்கம் உலகம்');
    vi.unstubAllGlobals();
  });

  it('offers guided controls for untimed multilingual lyrics without inventing timing', () => {
    const markup = renderToStaticMarkup(<LyricsEditor
      lines={[{ id: 'plain-0', time: 0, timed: false, text: 'മലയാളം വരി' }]}
      onChange={() => undefined}
      getPlaybackTime={() => 12.5}
      onTogglePlayback={() => undefined}
      onSeekBy={() => undefined}
      songTitle="Song"
      songArtist="Artist"
      originalTitle="Song.mp3"
      songDuration={120}
      vocalsUrl="blob:vocals"
      onMetadata={() => undefined}
    />);
    expect(markup).toContain('മലയാളം വരി');
    expect(markup).toContain('Play / pause');
    expect(markup).toContain('Rewind 3s');
    expect(markup).toContain('Undo timestamp');
    expect(markup).toContain('Timestamp next line');
    expect(markup).toContain('Detect draft lyrics locally');
    expect(markup).toContain('Auto-detect');
    expect(markup).toContain('Malayalam');
  });
});
