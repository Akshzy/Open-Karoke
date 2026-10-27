import { describe, expect, it } from 'vitest';
import { activeLyricIndex, formatTimestamp, lyricDisplayState, nextLyricIndex, parseLrc, parseTimestamp, serializeLrc, wordHighlightState } from './lrc';

describe('LRC parsing', () => {
  it('preserves multilingual text and sorts timestamps', () => {
    const result = parseLrc('[00:02.00]வணக்கம்\n[00:01.25]നമസ്കാരം\n[00:03.500]नमस्ते\n[00:04]Hello');
    expect(result.map((line) => line.text)).toEqual(['നമസ്കാരം', 'வணக்கம்', 'नमस्ते', 'Hello']);
    expect(result.map((line) => line.time)).toEqual([1.25, 2, 3.5, 4]);
  });

  it('supports multiple timestamps on one lyric line', () => {
    const result = parseLrc('[00:01.00][00:05.50]Repeat');
    expect(result).toHaveLength(2);
    expect(result[1].time).toBe(5.5);
  });

  it('round-trips times and UTF-8 text', () => {
    const lines = parseLrc('[01:02.34]ഒരു വരി');
    expect(parseTimestamp(formatTimestamp(lines[0].time))).toBeCloseTo(62.34);
    expect(serializeLrc(lines, 'പാട്ട്')).toContain('[01:02.34]ഒരു വരി');
  });

  it('selects the active line with a global offset', () => {
    const lines = parseLrc('[00:01.00]One\n[00:03.00]Two');
    expect(activeLyricIndex(lines, 2.8, 0.3)).toBe(1);
    expect(activeLyricIndex(lines, 0.5, 0)).toBe(-1);
  });

  it('ignores untimed plain lyrics without inventing playback timing', () => {
    const lines = [
      { id: 'plain', time: 0, timed: false, text: 'Untimed' },
      { id: 'timed', time: 2, text: 'Timed' },
    ];
    expect(activeLyricIndex(lines, 1, 0)).toBe(-1);
    expect(activeLyricIndex(lines, 2, 0)).toBe(1);
    expect(nextLyricIndex(lines, -1)).toBe(1);
    expect(serializeLrc(lines)).not.toContain('Untimed');
  });

  it('tracks word highlighting across playback and offset', () => {
    expect(wordHighlightState(1, 2, undefined, 0.8, 0.3)).toBe('active');
    expect(wordHighlightState(1, 2, undefined, 1.7, 0.3)).toBe('past');
    expect(wordHighlightState(2, undefined, 3, 1, 0)).toBe('future');
  });

  it('distinguishes empty lyrics, intro, active lyrics, and instrumental gaps while seeking', () => {
    const lines = [{ id: '1', time: 2, endTime: 4, text: 'Hello' }, { id: '2', time: 7, endTime: 9, text: 'Again' }];
    expect(lyricDisplayState([], 0)).toMatchObject({ kind: 'empty' });
    expect(lyricDisplayState(lines, 1)).toMatchObject({ kind: 'intro', nextIndex: 0 });
    expect(lyricDisplayState(lines, 3)).toMatchObject({ kind: 'lyric', currentIndex: 0 });
    expect(lyricDisplayState(lines, 5)).toMatchObject({ kind: 'gap', nextIndex: 1 });
    expect(lyricDisplayState(lines, 7.5)).toMatchObject({ kind: 'lyric', currentIndex: 1 });
    expect(lyricDisplayState(lines, 1)).toMatchObject({ kind: 'intro' });
  });
});
