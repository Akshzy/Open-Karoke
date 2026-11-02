import { useEffect, useRef, useState } from 'react';
import type { LyricLine, SeparationStatus, SongState, VideoAspect, WorkflowStep } from './types';
import { enhanceVocalStem, inspectAudio, separateSong } from './lib/audio';
import { loadProject, saveProject } from './lib/storage';
import { StepHeader } from './components/StepHeader';
import { UploadStep } from './components/UploadStep';
import { EditStep } from './components/EditStep';
import { DownloadStep } from './components/DownloadStep';
import { Icon } from './components/Icons';
import { metadataFromFilename } from './lib/metadata';

const initialStatus: SeparationStatus = {
  phase: 'idle', fraction: 0, detail: 'Ready to split locally', backend: 'gpu' in navigator ? 'WebGPU' : 'WASM',
};

export default function App() {
  const restored = useRef(loadProject()).current;
  const [step, setStep] = useState<WorkflowStep>(1);
  const [song, setSong] = useState<SongState | null>(null);
  const [status, setStatus] = useState<SeparationStatus>(initialStatus);
  const [vocalStatus, setVocalStatus] = useState<SeparationStatus>(initialStatus);
  const [lyrics, setLyrics] = useState<LyricLine[]>(restored?.lyrics ?? []);
  const [offset, setOffset] = useState(restored?.offset ?? 0);
  const [aspect, setAspect] = useState<VideoAspect>(restored?.aspect ?? 'portrait');
  const [toast, setToast] = useState('');
  const separationAbort = useRef<AbortController | null>(null);
  const vocalAbort = useRef<AbortController | null>(null);
  const fileLoadId = useRef(0);
  const songRef = useRef<SongState | null>(null);
  songRef.current = song;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => {
    const current = songRef.current;
    if (current) [current.originalUrl, current.instrumentalUrl, current.vocalsUrl].forEach((url) => url && URL.revokeObjectURL(url));
  }, []);

  const handleFile = async (file: File) => {
    const loadId = ++fileLoadId.current;
    separationAbort.current?.abort();
    vocalAbort.current?.abort();
    setStatus(initialStatus);
    setVocalStatus(initialStatus);
    try {
      const { duration } = await inspectAudio(file);
      if (loadId !== fileLoadId.current) return;
      if (duration > 15 * 60) throw new Error('For browser memory safety, this build limits songs to 15 minutes. Trim the file and try again.');
      if (song) [song.originalUrl, song.instrumentalUrl, song.vocalsUrl].forEach((url) => url && URL.revokeObjectURL(url));
      const metadata = metadataFromFilename(file.name);
      setLyrics([]);
      setOffset(0);
      setSong({ file, ...metadata, duration, originalUrl: URL.createObjectURL(file) });
    } catch (error) {
      setStatus({ ...initialStatus, phase: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  };

  const runVocalEnhancement = async () => {
    if (!song) return;
    const targetFile = song.file;
    vocalAbort.current = new AbortController();
    setVocalStatus({ ...initialStatus, phase: 'loading-model', detail: 'Loading the vocal-focused model' });
    try {
      const vocalsUrl = await enhanceVocalStem(song, setVocalStatus, vocalAbort.current.signal);
      const current = songRef.current;
      if (!current || current.file !== targetFile) {
        URL.revokeObjectURL(vocalsUrl);
        return;
      }
      const previousVocalsUrl = current.vocalsUrl;
      setSong({ ...current, vocalsUrl });
      if (previousVocalsUrl) URL.revokeObjectURL(previousVocalsUrl);
      setVocalStatus({ ...initialStatus, phase: 'done', fraction: 1, detail: 'Cleaner isolated vocals ready' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setVocalStatus({ ...initialStatus, phase: 'cancelled', detail: 'Vocal enhancement cancelled' });
      else setVocalStatus({ ...initialStatus, phase: 'error', error: error instanceof Error ? error.message : String(error) });
    } finally {
      vocalAbort.current = null;
    }
  };

  const runSeparation = async () => {
    if (!song) return;
    const targetFile = song.file;
    const controller = new AbortController();
    separationAbort.current = controller;
    setStatus({ ...initialStatus, phase: 'loading-model', detail: 'Loading the local AI model' });
    try {
      const stems = await separateSong(song, (next) => {
        if (songRef.current?.file === targetFile) setStatus(next);
      }, controller.signal);
      if (songRef.current?.file !== targetFile) {
        [stems.instrumentalUrl, stems.vocalsUrl].forEach(URL.revokeObjectURL);
        return;
      }
      setSong((current) => current?.file === targetFile ? { ...current, ...stems } : current);
      setStatus({ ...initialStatus, phase: 'done', fraction: 1, detail: 'Instrumental ready' });
    } catch (error) {
      if (songRef.current?.file === targetFile) {
        if (error instanceof DOMException && error.name === 'AbortError') setStatus({ ...initialStatus, phase: 'cancelled', detail: 'Cancelled' });
        else setStatus({ ...initialStatus, phase: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (separationAbort.current === controller) separationAbort.current = null;
    }
  };

  const navigate = (next: WorkflowStep) => {
    if (next > 1 && !song?.instrumentalUrl) { setToast('Create an instrumental before continuing.'); return; }
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const persist = () => {
    if (!song) return;
    saveProject({ title: song.title, fileName: song.file.name, lyrics, offset, aspect, savedAt: new Date().toISOString() });
    setToast('Project settings saved on this device.');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate(1)} aria-label="OpenKaraoke Studio home"><span><Icon name="music" /></span><strong>OPENKARAOKE</strong><small>STUDIO</small></button>
        <div className="local-badge"><i /> Local processing</div>
        <a href="#about">About</a>
      </header>
      <StepHeader current={step} onStep={navigate} />
      <main>
        {step === 1 && <UploadStep song={song} status={status} onFile={handleFile} onSeparate={runSeparation} onCancel={() => { separationAbort.current?.abort(); setToast('Cancellation requested. An active inference operation may need to finish first.'); }} onContinue={() => navigate(2)} />}
        {step === 2 && song?.instrumentalUrl && <EditStep song={song} lines={lyrics} offset={offset} vocalStatus={vocalStatus} onEnhanceVocals={() => void runVocalEnhancement()} onCancelVocalEnhancement={() => vocalAbort.current?.abort()} onLines={setLyrics} onMetadata={(metadata) => setSong((current) => current ? { ...current, ...metadata } : current)} onOffset={setOffset} onSave={persist} onContinue={() => navigate(3)} />}
        {step === 3 && song?.instrumentalUrl && song.vocalsUrl && <DownloadStep song={song} lines={lyrics} offset={offset} aspect={aspect} onAspect={setAspect} />}
      </main>
      <footer id="about">
        <div><strong>OpenKaraoke Studio</strong><span>Free, open source, and built for songs you have the right to use.</span></div>
        <div><span>No account</span><span>No upload</span><span>No paid API</span></div>
      </footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
