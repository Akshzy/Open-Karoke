import { useCallback, useEffect, useRef, useState } from 'react';
import type { LyricLine } from '../types';
import { formatTimestamp, parseLrc, parseTimestamp } from '../lib/lrc';
import { lyricsFromRecord, searchLrclib, type RankedLyrics } from '../lib/lrclib';
import { Icon } from './Icons';

export function LyricsEditor(props: {
  lines: LyricLine[];
  onChange: (lines: LyricLine[]) => void;
  getPlaybackTime: () => number;
  songTitle: string;
  songArtist: string;
  originalTitle: string;
  songDuration: number;
  onMetadata: (metadata: { title: string; artist: string }) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(props.lines.length === 0);
  const [lookupState, setLookupState] = useState<'idle' | 'searching' | 'results' | 'applied' | 'no-match' | 'error'>('idle');
  const [lookupMessage, setLookupMessage] = useState('');
  const [candidates, setCandidates] = useState<RankedLyrics[]>([]);
  const lookupAbort = useRef<AbortController | null>(null);
  const lastAutoLookup = useRef('');
  useEffect(() => () => lookupAbort.current?.abort(), []);

  const importText = (text: string) => {
    const parsed = parseLrc(text);
    if (!parsed.length) return;
    props.onChange(parsed);
    setShowPaste(false);
  };
  const update = (index: number, patch: Partial<LyricLine>) => props.onChange(props.lines.map((line, i) => {
    if (i !== index) return line;
    if (patch.text !== undefined && patch.text !== line.text) return { ...line, ...patch, words: undefined };
    if (patch.time !== undefined) {
      const shift = patch.time - line.time;
      return {
        ...line, ...patch, timed: true,
        endTime: line.endTime === undefined ? undefined : line.endTime + shift,
        words: line.words?.map((word) => ({
          ...word,
          startTime: word.startTime + shift,
          endTime: word.endTime === undefined ? undefined : word.endTime + shift,
        })),
      };
    }
    return { ...line, ...patch };
  }));

  const applyCandidate = (candidate: RankedLyrics) => {
    try {
      const result = lyricsFromRecord(candidate);
      props.onChange(result.lines);
      setCandidates([]);
      setShowPaste(result.kind === 'plain');
      setLookupState('applied');
      setLookupMessage(result.kind === 'word'
        ? `Applied word-synchronized lyrics from LRCLIB (${candidate.duration.toFixed(1)}s).`
        : result.kind === 'line'
          ? `Applied line-synchronized lyrics from LRCLIB (${candidate.duration.toFixed(1)}s).`
          : 'Applied plain lyrics from LRCLIB. They remain untimed until you set timestamps manually.');
    } catch (error) {
      setLookupState('error');
      setLookupMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const lookup = useCallback(async () => {
    if (!props.songTitle.trim()) return;
    lookupAbort.current?.abort();
    lookupAbort.current = new AbortController();
    setLookupState('searching'); setLookupMessage(''); setCandidates([]);
    try {
      const results = await searchLrclib(props.songTitle, props.songArtist, props.songDuration, lookupAbort.current.signal);
      if (!results.length) {
        setLookupState('no-match');
        setLookupMessage('No synchronized lyrics found');
        setShowPaste(true);
        return;
      }
      setCandidates(results.slice(0, 8));
      setLookupState('results');
      setLookupMessage('Choose the matching recording. Synchronized results are ranked first.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setLookupState('error'); setLookupMessage(error instanceof Error ? error.message : String(error));
    }
  }, [props.songTitle, props.songArtist, props.songDuration]);

  useEffect(() => {
    if (!props.songTitle.trim() || props.lines.some((line) => line.timed !== false)) return;
    const key = `${props.songTitle}\u0000${props.songArtist}\u0000${props.songDuration.toFixed(2)}`;
    if (lastAutoLookup.current === key) return;
    const timer = window.setTimeout(() => {
      lastAutoLookup.current = key;
      void lookup();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [lookup, props.lines, props.songTitle, props.songArtist, props.songDuration]);

  return (
    <div className="lyrics-editor">
      <div className="card-title">
        <div><p className="eyebrow">Lyrics & timing</p><h2>Make every line land.</h2></div>
        <div className="compact-actions">
          <button className="text-button" onClick={() => fileInput.current?.click()}>Import LRC</button>
          <button className="text-button" onClick={() => setShowPaste((value) => !value)}>Paste</button>
        </div>
      </div>
      <input ref={fileInput} hidden type="file" accept=".lrc,text/plain" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (file) importText(await file.text());
      }} />

      <div className="lyrics-lookup">
        <div className="lookup-heading"><strong>Find Lyrics</strong><span>LRCLIB · optional metadata lookup</span></div>
        <div className="lookup-fields">
          <label>Title<input value={props.songTitle} onChange={(event) => props.onMetadata({ title: event.target.value, artist: props.songArtist })} /></label>
          <label>Artist <span>(optional)</span><input value={props.songArtist} onChange={(event) => props.onMetadata({ title: props.songTitle, artist: event.target.value })} placeholder="Original recording artist" /></label>
          <button className="button primary find-lyrics-button" disabled={!props.songTitle.trim() || lookupState === 'searching'} onClick={() => void lookup()}>
            {lookupState === 'searching' ? 'Searching…' : 'Find Lyrics'}
          </button>
        </div>
        <small>Derived from “{props.originalTitle}”. Only title, optional artist, and duration ({props.songDuration.toFixed(1)}s) are sent to LRCLIB. Audio never leaves this device.</small>
        {lookupMessage && <p className={lookupState === 'error' ? 'error' : 'lookup-message'} role="status">{lookupMessage}</p>}
        {lookupState === 'no-match' && <div className="no-lyrics-actions">
          <button className="button secondary" onClick={() => fileInput.current?.click()}>Import synchronized LRC</button>
          <button className="button secondary" onClick={() => setShowPaste(true)}>Paste LRC manually</button>
        </div>}
        {candidates.length > 0 && <div className="lyrics-candidates" aria-label="LRCLIB lyric matches">
          {candidates.map((candidate) => <button key={candidate.id} onClick={() => applyCandidate(candidate)}>
            <span><strong>{candidate.trackName}</strong><small>{candidate.artistName} · {candidate.albumName || 'Unknown album'}</small></span>
            <span className={`sync-badge ${candidate.syncKind}`}>{candidate.syncKind === 'word' ? 'Word synced' : candidate.syncKind === 'line' ? 'Line synced' : 'Unsynced'}</span>
            <small>{candidate.duration.toFixed(1)}s · Δ {candidate.durationDifference.toFixed(1)}s</small>
          </button>)}
        </div>}
      </div>

      {showPaste && (
        <div className="paste-box">
          <label htmlFor="lrc-paste">Paste synchronized LRC</label>
          <textarea id="lrc-paste" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'[00:12.50]First lyric line\n[00:16.20]അടുത്ത വരി'} />
          <div className="button-row"><button className="button secondary" disabled={!parseLrc(paste).length} onClick={() => importText(paste)}>Use these timestamps</button></div>
          <small>Malayalam, Tamil, Hindi, and English are preserved exactly. The app never invents words or timing.</small>
        </div>
      )}

      <div className="line-list" aria-label="Timed lyric lines">
        {props.lines.map((line, index) => (
          <div className="lyric-row" key={line.id}>
            <button className="time-capture" onClick={() => update(index, { time: props.getPlaybackTime() })} title="Set to current playback time">●</button>
            <input
              aria-label={`Timestamp for line ${index + 1}`}
              className="time-input"
              defaultValue={line.timed === false ? '' : formatTimestamp(line.time)}
              placeholder="Untimed"
              key={`${line.id}-${line.time}`}
              onBlur={(event) => { const parsed = parseTimestamp(event.target.value); if (parsed !== null) update(index, { time: parsed }); else event.target.value = line.timed === false ? '' : formatTimestamp(line.time); }}
            />
            <input aria-label={`Text for line ${index + 1}`} value={line.text} onChange={(event) => update(index, { text: event.target.value })} />
            <button className="icon-button" aria-label={`Delete line ${index + 1}`} onClick={() => props.onChange(props.lines.filter((_, i) => i !== index))}><Icon name="trash" /></button>
          </div>
        ))}
      </div>
      <button className="add-line" onClick={() => props.onChange([...props.lines, { id: crypto.randomUUID(), time: props.getPlaybackTime(), text: '' }].sort((a, b) => a.time - b.time))}><Icon name="plus" /> Add line at playhead</button>
    </div>
  );
}
