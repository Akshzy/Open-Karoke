import { createSeparator, SeparationStage, type SeparationProgress } from 'web-audio-separation';
import type { SeparationStatus, SongState } from '../types';
import { ensureKaraokeModel, ensureVocalModel, KARAOKE_MODEL_URL, VOCAL_MODEL_URL } from './modelCache';

export async function inspectAudio(file: File): Promise<{ duration: number }> {
  if (!file.size) throw new Error('The selected audio file is empty.');
  const url = URL.createObjectURL(file);
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', loaded);
        audio.removeEventListener('error', failed);
      };
      const loaded = () => {
        cleanup();
        if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration);
        else reject(new Error('The audio has no playable duration.'));
      };
      const failed = () => {
        cleanup();
        reject(new Error('The browser could not read this audio format.'));
      };
      audio.addEventListener('loadedmetadata', loaded, { once: true });
      audio.addEventListener('error', failed, { once: true });
      audio.src = url;
    });
    return { duration };
  } catch (error) {
    throw new Error(`This browser could not open ${file.name}. Try MP3 or WAV. ${error instanceof Error ? error.message : ''}`.trim());
  } finally {
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
  }
}

const stageText: Record<SeparationProgress['stage'], string> = {
  [SeparationStage.LoadingModel]: 'Loading the local AI model',
  [SeparationStage.Demixing]: 'Removing vocals',
  [SeparationStage.WritingOutput]: 'Preparing WAV downloads',
};

export function mapMdxStemUrls(urls: string[], primaryStem: 'instrumental' | 'vocals') {
  if (urls.length !== 2) throw new Error('The separator did not return both expected stems.');
  // web-audio-separation returns the derived secondary stem first, then the model's primary stem.
  return primaryStem === 'instrumental'
    ? { vocalsUrl: urls[0], instrumentalUrl: urls[1] }
    : { instrumentalUrl: urls[0], vocalsUrl: urls[1] };
}

export async function separateSong(
  song: SongState,
  onStatus: (status: SeparationStatus) => void,
  signal: AbortSignal,
): Promise<{ vocalsUrl: string; instrumentalUrl: string }> {
  const backend: SeparationStatus['backend'] = 'gpu' in navigator ? 'WebGPU' : 'WASM';
  await ensureKaraokeModel(({ loaded, total, cached }) => {
    if (signal.aborted) return;
    onStatus({
      phase: 'loading-model',
      fraction: total > 0 ? loaded / total : 0,
      detail: cached
        ? 'Using cached karaoke model'
        : `Downloading karaoke model · ${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`,
      backend,
    });
  }, signal);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

  const separator = createSeparator('UVR-MDX-NET-Inst_HQ_3', {
    common: {
      logLevel: 'warning',
      modelPath: KARAOKE_MODEL_URL,
      modelUrl: KARAOKE_MODEL_URL,
      onProgress(progress) {
        if (signal.aborted) return;
        const chunk = progress.chunk !== undefined && progress.totalChunks !== undefined ? ` · ${progress.chunk}/${progress.totalChunks}` : '';
        onStatus({
          phase: progress.stage,
          fraction: progress.fraction,
          detail: `${stageText[progress.stage]}${chunk}`,
          backend,
        });
      },
    },
    mdx: { executionProviders: ['webgpu', 'wasm'], segmentSize: 256, overlap: 0.25, batchSize: 1 },
  });

  await separator.loadModel();
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const urls = await separator.separate(song.originalUrl);
  if (signal.aborted) {
    urls.forEach(URL.revokeObjectURL);
    throw new DOMException('Cancelled', 'AbortError');
  }
  return mapMdxStemUrls(urls, 'instrumental');
}

export async function enhanceVocalStem(
  song: SongState,
  onStatus: (status: SeparationStatus) => void,
  signal: AbortSignal,
): Promise<string> {
  const backend: SeparationStatus['backend'] = 'gpu' in navigator ? 'WebGPU' : 'WASM';
  await ensureVocalModel(({ loaded, total, cached }) => {
    if (signal.aborted) return;
    onStatus({
      phase: 'loading-model',
      fraction: total > 0 ? loaded / total : 0,
      detail: cached ? 'Using cached vocal model' : `Downloading vocal model · ${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`,
      backend,
    });
  }, signal);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

  const separator = createSeparator('Kim_Vocal_2', {
    common: {
      logLevel: 'warning', modelPath: VOCAL_MODEL_URL, modelUrl: VOCAL_MODEL_URL,
      onProgress(progress) {
        if (signal.aborted) return;
        const chunk = progress.chunk !== undefined && progress.totalChunks !== undefined ? ` · ${progress.chunk}/${progress.totalChunks}` : '';
        onStatus({ phase: progress.stage, fraction: progress.fraction, detail: `${stageText[progress.stage]}${chunk}`, backend });
      },
    },
    mdx: { executionProviders: ['webgpu', 'wasm'], segmentSize: 256, overlap: 0.25, batchSize: 1 },
  });

  await separator.loadModel();
  const inputUrl = URL.createObjectURL(song.file);
  try {
    const urls = await separator.separate(inputUrl);
    if (signal.aborted) {
      urls.forEach(URL.revokeObjectURL);
      throw new DOMException('Cancelled', 'AbortError');
    }
    const stems = mapMdxStemUrls(urls, 'vocals');
    URL.revokeObjectURL(stems.instrumentalUrl);
    return stems.vocalsUrl;
  } finally {
    URL.revokeObjectURL(inputUrl);
  }
}
