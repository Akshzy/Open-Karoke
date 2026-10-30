import type { LyricLine } from '../types';

const TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(input: string): LyricLine[] {
  const lines: LyricLine[] = [];
  let serial = 0;
  for (const raw of input.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const matches = [...raw.matchAll(TIMESTAMP)];
    if (!matches.length) continue;
    const text = raw.replace(TIMESTAMP, '').trim();
    for (const match of matches) {
      const fractionRaw = match[3] ?? '0';
      const fraction = Number(fractionRaw) / 10 ** fractionRaw.length;
      lines.push({
        id: `lrc-${serial++}`,
        time: Number(match[1]) * 60 + Number(match[2]) + fraction,
        text,
      });
    }
  }
  const sorted = lines.sort((a, b) => a.time - b.time);
  const lyrics: LyricLine[] = [];
  for (const line of sorted) {
    if (line.text) {
      lyrics.push(line);
      continue;
    }
    const previous = lyrics.at(-1);
    if (previous && line.time >= previous.time) previous.endTime = line.time;
  }
  return lyrics;
}

export function parsePlainLyrics(input: string): LyricLine[] {
  return input.replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `plain-${index}`, time: 0, timed: false, text }));
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const secs = safe - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

export function parseTimestamp(value: string): number | null {
  const trimmed = value.trim();
  const match = /^(?:(\d+):)?(\d{1,2})(?:[.:](\d{1,3}))?$/.exec(trimmed);
  if (!match) return null;
  const fractionRaw = match[3] ?? '0';
  const result = Number(match[1] ?? 0) * 60 + Number(match[2]) + Number(fractionRaw) / 10 ** fractionRaw.length;
  return Number.isFinite(result) ? result : null;
}

export function serializeLrc(lines: LyricLine[], title?: string): string {
  const header = title ? `[ti:${title}]\n` : '';
  return header + lines.filter((line) => line.timed !== false).sort((a, b) => a.time - b.time).map((line) => `[${formatTimestamp(line.time)}]${line.text}`).join('\n');
}

export function activeLyricIndex(lines: LyricLine[], playbackTime: number, offsetSeconds = 0): number {
  const adjusted = playbackTime + offsetSeconds;
  let active = -1;
  let activeTime = -Infinity;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timed !== false && lines[i].time <= adjusted && lines[i].time >= activeTime) {
      active = i;
      activeTime = lines[i].time;
    }
  }
  return active;
}

export function nextLyricIndex(lines: LyricLine[], activeIndex: number): number {
  const after = activeIndex >= 0 ? lines[activeIndex].time : -Infinity;
  let next = -1;
  let nextTime = Infinity;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timed !== false && lines[i].time > after && lines[i].time < nextTime) {
      next = i;
      nextTime = lines[i].time;
    }
  }
  return next;
}

export interface LyricDisplayState {
  kind: 'empty' | 'intro' | 'lyric' | 'gap';
  currentIndex: number;
  nextIndex: number;
}

export function lyricDisplayState(lines: LyricLine[], playbackTime: number, offsetSeconds = 0): LyricDisplayState {
  const timed = lines.filter((line) => line.timed !== false);
  if (!timed.length) return { kind: 'empty', currentIndex: -1, nextIndex: -1 };
  const adjusted = playbackTime + offsetSeconds;
  const currentIndex = activeLyricIndex(lines, playbackTime, offsetSeconds);
  if (currentIndex < 0) return { kind: 'intro', currentIndex: -1, nextIndex: nextLyricIndex(lines, -1) };

  const line = lines[currentIndex];
  const nextIndex = nextLyricIndex(lines, currentIndex);
  const lastWordEnd = line.words?.at(-1)?.endTime;
  const explicitEnd = line.endTime ?? lastWordEnd;
  if (explicitEnd !== undefined && adjusted >= explicitEnd) {
    return { kind: 'gap', currentIndex: -1, nextIndex };
  }
  return { kind: 'lyric', currentIndex, nextIndex };
}

export function wordHighlightState(
  startTime: number,
  endTime: number | undefined,
  nextStartTime: number | undefined,
  playbackTime: number,
  offsetSeconds = 0,
): 'future' | 'active' | 'past' {
  const adjusted = playbackTime + offsetSeconds;
  if (adjusted < startTime) return 'future';
  const end = endTime ?? nextStartTime;
  return end !== undefined && adjusted >= end ? 'past' : 'active';
}
