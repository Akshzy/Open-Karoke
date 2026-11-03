import { useRef, useState } from 'react';
import type { SeparationStatus, SongState } from '../types';
import { Icon } from './Icons';

function timeLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function UploadStep(props: {
  song: SongState | null;
  status: SeparationStatus;
  onFile: (file: File) => Promise<void>;
  onSeparate: () => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = ['loading-model', 'demixing', 'writing-output'].includes(props.status.phase);
  const choose = (file?: File) => file && props.onFile(file);

  return (
    <section className="step-panel" aria-labelledby="upload-title">
      <div className="section-heading">
        <p className="eyebrow">1 / 3 · Upload</p>
        <h1 id="upload-title">Choose a song</h1>
        <p>Your audio stays on this device. The first vocal split downloads a reusable open-source AI model.</p>
      </div>

      {!props.song ? (
        <button
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
        >
          <span className="upload-icon"><Icon name="upload" /></span>
          <strong>Upload audio</strong>
          <small>or drop MP3, WAV, or browser-supported FLAC</small>
          <span className="file-pill">Browse files</span>
        </button>
      ) : (
        <div className="song-card">
          <div className="record" aria-hidden="true"><Icon name="music" /></div>
          <div className="song-meta">
            <small>Ready on this device</small>
            <strong>{props.song.title}</strong>
            {props.song.artist && <span>{props.song.artist}</span>}
            <span>{timeLabel(props.song.duration)} · {(props.song.file.size / 1024 / 1024).toFixed(1)} MB · {props.song.file.type || 'audio'}</span>
          </div>
          <button className="icon-button" disabled={busy} onClick={() => input.current?.click()} aria-label={busy ? 'Wait for processing before choosing another song' : 'Choose a different song'}><Icon name="trash" /></button>
        </div>
      )}
      <input
        ref={input}
        hidden
        type="file"
        accept="audio/mpeg,audio/wav,audio/x-wav,audio/flac"
        onClick={(event) => { event.currentTarget.value = ''; }}
        onChange={(event) => {
          choose(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      {props.song && props.status.phase !== 'done' && (
        <div className="process-card">
          <div className="process-top">
            <span className="upload-icon small"><Icon name="music" /></span>
            <div><strong>{busy ? props.status.detail : 'Create the instrumental'}</strong><small>{props.status.backend === 'WASM' ? 'WASM compatibility mode · keep this tab open' : 'WebGPU preferred · WASM fallback'} · model cached after first use</small></div>
            <b>{busy ? `${Math.round(props.status.fraction * 100)}%` : 'ON DEVICE'}</b>
          </div>
          {busy && <progress value={props.status.fraction} max={1}>{props.status.fraction}</progress>}
          {props.status.error && <p className="error" role="alert">{props.status.error}</p>}
          <div className="button-row">
            {busy ? <button className="button secondary" onClick={props.onCancel}><Icon name="stop" /> Cancel after current operation</button>
              : <button className="button primary" onClick={props.onSeparate}><Icon name="music" /> Remove vocals locally</button>}
          </div>
        </div>
      )}

      {props.status.phase === 'done' && (
        <div className="success-card" role="status">
          <Icon name="check" />
          <div><strong>Karaoke and vocals are ready</strong><small>Instrumental and isolated-vocal WAV stems were created locally.</small></div>
          <button className="button primary" onClick={props.onContinue}>Sync lyrics <span>→</span></button>
        </div>
      )}

      <div className="privacy-strip"><Icon name="shield" /><span><strong>No cloud processing.</strong> Open-source model/runtime files are fetched; your audio never leaves this browser.</span></div>
    </section>
  );
}
