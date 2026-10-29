import { useRef, useState } from 'react';
import type { LyricLine, SeparationStatus, SongState } from '../types';
import { KaraokePlayer, type PlayerHandle } from './KaraokePlayer';
import { LyricsEditor } from './LyricsEditor';
import { Icon } from './Icons';

export function EditStep(props: {
  song: SongState;
  lines: LyricLine[];
  offset: number;
  vocalStatus: SeparationStatus;
  onEnhanceVocals: () => void;
  onCancelVocalEnhancement: () => void;
  onLines: (lines: LyricLine[]) => void;
  onMetadata: (metadata: { title: string; artist: string }) => void;
  onOffset: (offset: number) => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  const player = useRef<PlayerHandle>(null);
  const [preview, setPreview] = useState<'karaoke' | 'vocals'>('karaoke');
  const enhancingVocals = ['loading-model', 'demixing', 'writing-output'].includes(props.vocalStatus.phase);
  return (
    <section className="step-panel wide" aria-labelledby="edit-title">
      <div className="section-heading compact-heading">
        <div><p className="eyebrow">Step 02</p><h1 id="edit-title">Sync the words.<br/><em>Own the moment.</em></h1></div>
        <p>Import real LRC timestamps or tap the red dot beside a line at the exact playhead position.</p>
      </div>
      <div className="editor-grid">
        <div className="preview-column">
          <div className="stem-toggle" aria-label="Audio preview source">
            <button className={preview === 'karaoke' ? 'selected' : ''} aria-pressed={preview === 'karaoke'} onClick={() => setPreview('karaoke')}>
              <strong>Karaoke + lyrics</strong><small>Instrumental stem</small>
            </button>
            <button className={preview === 'vocals' ? 'selected' : ''} aria-pressed={preview === 'vocals'} onClick={() => setPreview('vocals')}>
              <strong>Isolated vocals</strong><small>Voice stem</small>
            </button>
          </div>
          <KaraokePlayer
            ref={player}
            audioUrl={preview === 'karaoke' ? props.song.instrumentalUrl! : props.song.vocalsUrl!}
            title={props.song.title}
            lines={props.lines}
            offset={props.offset}
            onOffset={props.onOffset}
            variant={preview}
          />
          {preview === 'vocals' && <div className="vocal-quality-card">
            <div>
              <strong>{props.vocalStatus.phase === 'done' ? 'Cleaner vocal stem active' : 'Hear instruments behind the voice?'}</strong>
              <small>{enhancingVocals ? props.vocalStatus.detail : props.vocalStatus.phase === 'done' ? 'Created locally with the cached vocal-focused model.' : 'Optional vocal-focused pass · about 67 MB once · karaoke stays unchanged.'}</small>
            </div>
            {enhancingVocals
              ? <button className="button secondary" onClick={props.onCancelVocalEnhancement}>Cancel after current operation</button>
              : props.vocalStatus.phase !== 'done' && <button className="button secondary" onClick={props.onEnhanceVocals}>Improve vocals</button>}
            {enhancingVocals && <progress value={props.vocalStatus.fraction} max={1} />}
            {props.vocalStatus.error && <p className="error" role="alert">{props.vocalStatus.error}</p>}
          </div>}
        </div>
        <LyricsEditor
          lines={props.lines}
          onChange={props.onLines}
          getPlaybackTime={() => player.current?.currentTime() ?? 0}
          onTogglePlayback={() => { void player.current?.togglePlayback(); }}
          onSeekBy={(seconds) => player.current?.seekBy(seconds)}
          songTitle={props.song.title}
          songArtist={props.song.artist}
          originalTitle={props.song.originalTitle}
          songDuration={props.song.duration}
          vocalsUrl={props.song.vocalsUrl!}
          onMetadata={props.onMetadata}
        />
      </div>
      <div className="editor-footer">
        <button className="button secondary" onClick={props.onSave}><Icon name="save" /> Save project settings</button>
        <span>Audio remains session-only to avoid filling browser storage.</span>
        <button className="button primary" onClick={props.onContinue}>Prepare downloads <span>→</span></button>
      </div>
    </section>
  );
}
