import { useRef, useState } from 'react';
import type { LyricLine, SongState } from '../types';
import { KaraokePlayer, type PlayerHandle } from './KaraokePlayer';
import { LyricsEditor } from './LyricsEditor';
import { Icon } from './Icons';

export function EditStep(props: {
  song: SongState;
  lines: LyricLine[];
  offset: number;
  onLines: (lines: LyricLine[]) => void;
  onMetadata: (metadata: { title: string; artist: string }) => void;
  onOffset: (offset: number) => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  const player = useRef<PlayerHandle>(null);
  const [preview, setPreview] = useState<'karaoke' | 'vocals'>('karaoke');
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
        </div>
        <LyricsEditor
          lines={props.lines}
          onChange={props.onLines}
          getPlaybackTime={() => player.current?.currentTime() ?? 0}
          songTitle={props.song.title}
          songArtist={props.song.artist}
          originalTitle={props.song.originalTitle}
          songDuration={props.song.duration}
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
