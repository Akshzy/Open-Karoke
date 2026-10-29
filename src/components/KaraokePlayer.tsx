import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { LyricLine } from '../types';
import { lyricDisplayState, wordHighlightState } from '../lib/lrc';
import { Icon } from './Icons';

export interface PlayerHandle {
  currentTime: () => number;
  togglePlayback: () => Promise<void>;
  seekBy: (seconds: number) => void;
}

export const KaraokePlayer = forwardRef<PlayerHandle, {
  audioUrl: string;
  title: string;
  lines: LyricLine[];
  offset: number;
  onOffset: (value: number) => void;
  variant?: 'karaoke' | 'vocals';
}>((props, ref) => {
  const audio = useRef<HTMLAudioElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const toggle = async () => {
    if (!audio.current) return;
    if (audio.current.paused) await audio.current.play(); else audio.current.pause();
  };
  const seekBy = (seconds: number) => {
    if (!audio.current) return;
    const limit = Number.isFinite(audio.current.duration) ? audio.current.duration : Number.POSITIVE_INFINITY;
    audio.current.currentTime = Math.max(0, Math.min(limit, audio.current.currentTime + seconds));
  };
  useImperativeHandle(ref, () => ({
    currentTime: () => audio.current?.currentTime ?? 0,
    togglePlayback: toggle,
    seekBy,
  }));
  const karaoke = props.variant !== 'vocals';
  const activeLines = karaoke ? props.lines : [];
  const activeOffset = karaoke ? props.offset : 0;
  useEffect(() => {
    if (!audio.current) return;
    audio.current.pause();
    audio.current.src = props.audioUrl;
    audio.current.load();
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, [props.audioUrl]);
  const display = lyricDisplayState(activeLines, time, activeOffset);
  const current = display.currentIndex >= 0 ? activeLines[display.currentIndex] : undefined;
  const next = display.nextIndex >= 0 ? activeLines[display.nextIndex]?.text : '';
  const fallback = !karaoke ? 'Isolated vocals preview'
    : display.kind === 'empty' ? 'No lyrics loaded'
    : display.kind === 'intro' ? 'Instrumental intro'
      : display.kind === 'gap' ? 'Instrumental break' : '';
  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  return (
    <div className="player-shell">
      <div className="preview-stage" ref={stage}>
        <div className="stage-orb" />
        <p className="stage-title">{props.title} · {karaoke ? 'Karaoke' : 'Vocals'}</p>
        <div className="stage-lyrics" aria-live="polite">
          <strong>{current?.words?.length ? current.words.map((word, index) => {
            const state = wordHighlightState(word.startTime, word.endTime, current.words?.[index + 1]?.startTime, time, activeOffset);
            return <span className={`karaoke-word ${state}`} key={`${word.startTime}-${index}`}>{word.text}</span>;
          }) : current?.text ?? fallback}</strong>
          <span>{next}</span>
        </div>
        <button className="fullscreen-button" onClick={() => stage.current?.requestFullscreen?.()} aria-label="Open fullscreen"><Icon name="fullscreen" /></button>
      </div>
      <audio ref={audio} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onDurationChange={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <div className="transport">
        <button className="play-button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} /></button>
        <span>{format(time)}</span>
        <input aria-label="Seek" type="range" min={0} max={duration || 1} step={0.05} value={Math.min(time, duration || 1)} onChange={(event) => { if (audio.current) audio.current.currentTime = Number(event.target.value); }} />
        <span>{format(duration || 0)}</span>
      </div>
      {karaoke && <div className="offset-control">
        <label htmlFor="offset">Lyric offset <strong>{props.offset >= 0 ? '+' : ''}{props.offset.toFixed(1)}s</strong></label>
        <input id="offset" type="range" min={-5} max={5} step={0.1} value={props.offset} onChange={(event) => props.onOffset(Number(event.target.value))} />
        <small>Positive shows lyrics earlier</small>
      </div>}
    </div>
  );
});

KaraokePlayer.displayName = 'KaraokePlayer';
