import type { LyricLine, LyricWord } from '../types';
import { parseLrc } from './lrc';

const API_BASE = 'https://lrclib.net';
const CLIENT_HEADER = 'OpenKaraoke Studio v0.1.0';

export interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  hasWordSync: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  lyricsfile: string;
}

export interface RankedLyrics extends LrclibRecord {
  score: number;
  durationDifference: number;
  syncKind: 'word' | 'line' | 'plain';
}

function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function tokenSimilarity(left: string, right: string) {
  const a = new Set(normalize(left).split(' ').filter(Boolean));
  const b = new Set(normalize(right).split(' ').filter(Boolean));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return (2 * shared) / (a.size + b.size);
}

export function rankLyricsCandidates(records: LrclibRecord[], title: string, artist: string, duration: number): RankedLyrics[] {
  return records
    .filter((record) => !record.instrumental && Boolean(record.lyricsfile || record.syncedLyrics || record.plainLyrics))
    .map((record) => {
      const titleExact = normalize(record.trackName) === normalize(title);
      const artistExact = Boolean(normalize(artist)) && normalize(record.artistName) === normalize(artist);
      const durationDifference = Math.abs(record.duration - duration);
      const durationScore = durationDifference <= 2 ? 25 : durationDifference <= 5 ? 18 : durationDifference <= 15 ? 8 : Math.max(-20, 8 - durationDifference);
      const syncKind: RankedLyrics['syncKind'] = record.hasWordSync ? 'word' : record.syncedLyrics ? 'line' : 'plain';
      const score = (titleExact ? 45 : tokenSimilarity(record.trackName, title) * 40)
        + (artist ? (artistExact ? 30 : tokenSimilarity(record.artistName, artist) * 25) : 0)
        + durationScore + (syncKind === 'word' ? 6 : syncKind === 'line' ? 3 : 0);
      return { ...record, score, durationDifference, syncKind };
    })
    .sort((a, b) => b.score - a.score || a.durationDifference - b.durationDifference || Number(b.hasWordSync) - Number(a.hasWordSync));
}

export function isAmbiguousMatch(candidates: RankedLyrics[]) {
  if (candidates.length !== 1 && (!candidates[0] || !candidates[1] || candidates[0].score - candidates[1].score < 10)) return true;
  return Boolean(candidates[0] && candidates[0].score < 75);
}

function waitForRetry(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function lrclibError(status: number) {
  if (status >= 502 && status <= 504) {
    return new Error('LRCLIB is temporarily overloaded. Audio playback and LRC import still work.');
  }
  return new Error(`LRCLIB search failed (${status}).`);
}

export async function searchLrclib(title: string, artist: string, duration: number, signal?: AbortSignal) {
  const cleanTitle = title.trim();
  const cleanArtist = artist.trim();
  const request = async (path: string) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${API_BASE}${path}`, { headers: { 'Lrclib-Client': CLIENT_HEADER }, signal });
      if (response.status === 429) throw new Error(`LRCLIB rate limit reached. Try again${response.headers.get('Retry-After') ? ` after ${response.headers.get('Retry-After')} seconds` : ' shortly'}.`);
      if (response.status < 502 || response.status > 504 || attempt === 1) return response;
      const retryAfter = Number(response.headers.get('Retry-After'));
      await waitForRetry(Number.isFinite(retryAfter) ? Math.min(2000, Math.max(0, retryAfter * 1000)) : 1000, signal);
    }
    throw new Error('LRCLIB request failed.');
  };

  if (cleanArtist) {
    // /api/get is the only LRCLIB lookup that accepts duration and matches within ±2s.
    const exactQuery = new URLSearchParams({ track_name: cleanTitle, artist_name: cleanArtist, duration: String(duration) });
    const exactResponse = await request(`/api/get?${exactQuery}`);
    if (exactResponse.ok) return rankLyricsCandidates([await exactResponse.json() as LrclibRecord], cleanTitle, cleanArtist, duration);
    if (exactResponse.status !== 404) throw lrclibError(exactResponse.status);

    const preciseResponse = await request(`/api/search?${new URLSearchParams({ track_name: cleanTitle, artist_name: cleanArtist })}`);
    if (!preciseResponse.ok) throw lrclibError(preciseResponse.status);
    const precise = await preciseResponse.json() as LrclibRecord[];
    if (precise.length) return rankLyricsCandidates(precise, cleanTitle, cleanArtist, duration);
  }

  const broadResponse = await request(`/api/search?${new URLSearchParams({ track_name: cleanTitle })}`);
  if (!broadResponse.ok) throw lrclibError(broadResponse.status);
  return rankLyricsCandidates(await broadResponse.json() as LrclibRecord[], cleanTitle, cleanArtist, duration);
}

function scalar(value: string): string {
  const input = value.trim();
  if (input.startsWith("'") && input.endsWith("'")) return input.slice(1, -1).replace(/''/g, "'");
  if (input.startsWith('"') && input.endsWith('"')) {
    try { return JSON.parse(input) as string; } catch { throw new Error('Invalid quoted Lyricsfile text.'); }
  }
  return input;
}

interface ParsedEntry { text?: string; start_ms?: number; end_ms?: number; words?: ParsedEntry[] }

function assign(entry: ParsedEntry, source: string) {
  const match = /^(text|start_ms|end_ms):\s*(.*)$/.exec(source.trim());
  if (!match) return;
  if (match[1] === 'text') entry.text = scalar(match[2]);
  else {
    const value = Number(match[2]);
    if (Number.isInteger(value) && value >= 0) entry[match[1] as 'start_ms' | 'end_ms'] = value;
  }
}

export function parseLyricsfile(input: string, recordId = 0): LyricLine[] {
  if (!/^version:\s*['"]?1\.0['"]?\s*$/m.test(input)) throw new Error('Unsupported Lyricsfile version.');
  const lines: ParsedEntry[] = [];
  let inLines = false;
  let current: ParsedEntry | undefined;
  let currentWord: ParsedEntry | undefined;
  for (const raw of input.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const indent = raw.match(/^ */)?.[0].length ?? 0;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (indent === 0) { inLines = trimmed === 'lines:'; current = undefined; currentWord = undefined; continue; }
    if (!inLines) continue;
    if (indent === 2 && trimmed.startsWith('- ')) {
      current = {}; lines.push(current); currentWord = undefined; assign(current, trimmed.slice(2));
    } else if (indent === 4 && current && trimmed === 'words:') {
      current.words = []; currentWord = undefined;
    } else if (indent === 4 && current) {
      assign(current, trimmed);
    } else if (indent === 6 && current?.words && trimmed.startsWith('- ')) {
      currentWord = {}; current.words.push(currentWord); assign(currentWord, trimmed.slice(2));
    } else if (indent === 8 && currentWord) {
      assign(currentWord, trimmed);
    }
  }
  return lines.map((line, index) => {
    if (line.text === undefined || line.start_ms === undefined) throw new Error('Lyricsfile contains an invalid timed line.');
    const words: LyricWord[] | undefined = line.words?.length ? line.words.map((word) => {
      if (word.text === undefined || word.start_ms === undefined) throw new Error('Lyricsfile contains an invalid timed word.');
      return { text: word.text, startTime: word.start_ms / 1000, endTime: word.end_ms === undefined ? undefined : word.end_ms / 1000 };
    }) : undefined;
    return {
      id: `lrclib-${recordId}-${index}`,
      time: line.start_ms / 1000,
      endTime: line.end_ms === undefined ? undefined : line.end_ms / 1000,
      text: line.text,
      words,
    };
  });
}

export function lyricsFromRecord(record: LrclibRecord): { lines: LyricLine[]; kind: RankedLyrics['syncKind'] } {
  if (record.hasWordSync) {
    try {
      const lines = parseLyricsfile(record.lyricsfile, record.id);
      if (lines.some((line) => line.words?.length)) return { lines, kind: 'word' };
    } catch {
      // Prefer a valid legacy line-synced representation over rejecting the result.
    }
  }
  if (record.syncedLyrics) {
    const lines = parseLrc(record.syncedLyrics).map((line, index) => ({ ...line, id: `lrclib-${record.id}-${index}` }));
    if (lines.length) return { lines, kind: 'line' };
  }
  if (record.plainLyrics !== null) {
    const rawLines = record.plainLyrics.replace(/\r\n/g, '\n').split('\n');
    if (rawLines.at(-1) === '') rawLines.pop();
    return { lines: rawLines.map((text, index) => ({ id: `lrclib-${record.id}-${index}`, time: 0, timed: false, text })), kind: 'plain' };
  }
  throw new Error('This LRCLIB result contains no usable lyrics.');
}
