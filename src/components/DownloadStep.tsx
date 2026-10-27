import { useEffect, useRef, useState } from 'react';
import type { LyricLine, SongState, VideoAspect } from '../types';
import { downloadBlob, downloadUrl, safeBaseName } from '../lib/download';
import { exportKaraokeMp4, mp4Support } from '../lib/video';
import { serializeLrc } from '../lib/lrc';
import { Icon } from './Icons';

export function DownloadStep(props: {
  song: SongState;
  lines: LyricLine[];
  offset: number;
  aspect: VideoAspect;
  onAspect: (aspect: VideoAspect) => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const base = safeBaseName(props.song.title);
  useEffect(() => { mp4Support(props.aspect).then(setSupported).catch(() => setSupported(false)); }, [props.aspect]);

  const lrcBlob = () => new Blob([serializeLrc(props.lines, props.song.title)], { type: 'text/plain;charset=utf-8' });
  const exportVideo = async () => {
    setError(''); setExporting(true); setProgress(0);
    controller.current = new AbortController();
    try {
      const blob = await exportKaraokeMp4({
        audioUrl: props.song.instrumentalUrl!, title: props.song.title, lines: props.lines, offset: props.offset,
        aspect: props.aspect, signal: controller.current.signal, onProgress: (value, message) => { setProgress(value); setDetail(message); },
      });
      downloadBlob(blob, `${base}-${props.aspect}-karaoke.mp4`);
      setProgress(1); setDetail(`Ready · ${(blob.size / 1024 / 1024).toFixed(1)} MB MP4`);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') setDetail('Export cancelled');
      else setError(caught instanceof Error ? caught.message : String(caught));
    } finally { setExporting(false); controller.current = null; }
  };

  return (
    <section className="step-panel" aria-labelledby="download-title">
      <div className="section-heading">
        <p className="eyebrow">Step 03</p>
        <h1 id="download-title">Take it with you.<br/><em>Play it anywhere.</em></h1>
        <p>Exports are rendered on this device. MP4 needs browser H.264 and AAC encoders; audio + LRC always remains available.</p>
      </div>
      <div className="format-toggle" aria-label="Video aspect ratio">
        <button className={props.aspect === 'portrait' ? 'selected' : ''} onClick={() => props.onAspect('portrait')}><span className="phone-shape" /> <strong>Portrait</strong><small>9:16 · 720 × 1280</small></button>
        <button className={props.aspect === 'landscape' ? 'selected' : ''} onClick={() => props.onAspect('landscape')}><span className="screen-shape" /> <strong>Landscape</strong><small>16:9 · 1280 × 720</small></button>
      </div>
      <div className="download-list">
        <div className="download-item hero-download">
          <span className="download-icon"><Icon name="play" /></span>
          <div><strong>Karaoke video</strong><small>H.264 + AAC MP4 · instrumental + embedded lyric visuals</small></div>
          {exporting ? <button className="button secondary" onClick={() => controller.current?.abort()}><Icon name="stop" /> Cancel</button>
            : <button className="button primary" disabled={supported !== true} onClick={exportVideo}><Icon name="download" /> {supported === null ? 'Checking…' : supported ? 'Create MP4' : 'Unsupported'}</button>}
        </div>
        {(exporting || detail) && <div className="export-progress"><progress value={progress} max={1} /><span>{detail} · {Math.round(progress * 100)}%</span></div>}
        {error && <p className="error" role="alert">{error}</p>}
        {supported === false && <p className="notice">This browser cannot produce a standards-compliant MP4 here. Use the verified audio + LRC fallback below, or try a current Chromium-based desktop browser.</p>}
        <div className="download-item">
          <span className="download-icon"><Icon name="music" /></span>
          <div><strong>Instrumental karaoke</strong><small>44.1 kHz WAV · vocals removed · no lyrics embedded</small></div>
          <button className="button secondary" onClick={() => downloadUrl(props.song.instrumentalUrl!, `${base}-instrumental.wav`)}><Icon name="download" /> WAV</button>
        </div>
        <div className="download-item">
          <span className="download-icon text-icon">LRC</span>
          <div><strong>Synchronized karaoke lyrics</strong><small>UTF-8 LRC · exact timestamps · compatible with karaoke players</small></div>
          <button className="button secondary" onClick={() => downloadBlob(lrcBlob(), `${base}.lrc`)}><Icon name="download" /> LRC</button>
        </div>
        <div className="download-item">
          <span className="download-icon vocal-icon">VOX</span>
          <div><strong>Isolated vocals</strong><small>Separate voice-only WAV for preview or remixing</small></div>
          <button className="button secondary" onClick={() => downloadUrl(props.song.vocalsUrl!, `${base}-vocals.wav`)}><Icon name="download" /> WAV</button>
        </div>
      </div>
      <div className="privacy-strip"><Icon name="shield" /><span><strong>Offline-ready.</strong> Install the app after the first visit; the separation model is cached on demand by your browser.</span></div>
    </section>
  );
}
