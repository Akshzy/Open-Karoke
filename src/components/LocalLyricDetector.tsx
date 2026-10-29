import { useEffect, useRef, useState } from 'react';
import type { LyricLine } from '../types';
import { detectDraftLyrics, type DraftLanguage } from '../lib/draftLyrics';

export function LocalLyricDetector(props: { audioUrl: string; existingCount: number; onApply: (lines: LyricLine[]) => void }) {
  const [language, setLanguage] = useState<DraftLanguage>('');
  const [state, setState] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [detail, setDetail] = useState('');
  const [progress, setProgress] = useState(0);
  const [draft, setDraft] = useState<LyricLine[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const detect = async () => {
    controller.current?.abort();
    controller.current = new AbortController();
    setState('running'); setDetail('Preparing isolated vocals'); setProgress(0);
    try {
      const lines = await detectDraftLyrics(props.audioUrl, language, ({ detail: nextDetail, fraction }) => {
        setDetail(nextDetail); setProgress(fraction);
      }, controller.current.signal);
      setDraft(lines); setProgress(1); setDetail(`${lines.length} timestamped draft phrases detected`); setState('ready');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') { setState('idle'); setDetail('Detection cancelled'); }
      else { setState('error'); setDetail(error instanceof Error ? error.message : String(error)); }
    } finally { controller.current = null; }
  };

  return <div className="local-lyrics-card">
    <div className="lookup-heading"><strong>Detect draft lyrics locally</strong><span>Optional · Whisper</span></div>
    <p>Uses the isolated-vocal stem on this device. Detected words and timestamps can be wrong—review them before export.</p>
    <label>Song language
      <select value={language} disabled={state === 'running'} onChange={(event) => setLanguage(event.target.value as DraftLanguage)}>
        <option value="">Auto-detect</option><option value="malayalam">Malayalam</option><option value="tamil">Tamil</option><option value="hindi">Hindi</option><option value="english">English</option>
      </select>
    </label>
    {state === 'running' ? <div className="local-detect-progress"><progress value={progress} max={1} /><small>{detail}</small><button className="button secondary" onClick={() => controller.current?.abort()}>Cancel</button></div>
      : <button className="button secondary" onClick={() => void detect()}>Detect draft locally</button>}
    {state === 'error' && <p className="error" role="alert">{detail}</p>}
    {state === 'ready' && <div className="draft-result" role="status">
      <strong>{detail}</strong>
      <div>{draft.slice(0, 4).map((line) => <span key={line.id}>{line.text}</span>)}</div>
      <small>{props.existingCount ? `Applying will replace the ${props.existingCount} current editor lines.` : 'Nothing changes until you apply this draft.'}</small>
      <div className="button-row"><button className="button secondary" onClick={() => { setDraft([]); setState('idle'); }}>Discard</button><button className="button primary" onClick={() => { props.onApply(draft); setState('idle'); setDraft([]); }}>Apply draft to editor</button></div>
    </div>}
  </div>;
}
