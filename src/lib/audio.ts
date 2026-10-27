import { createSeparator, SeparationStage, type SeparationProgress } from 'web-audio-separation';
import type { SeparationStatus, SongState } from '../types';
import { ensureKaraokeModel, KARAOKE_MODEL_URL } from './modelCache';

export async function inspectAudio(file: File): Promise<{ duration: number }> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (!buffer.duration || !Number.isFinite(buffer.duration)) throw new Error('The audio has no playable duration.');
    return { duration: buffer.duration };
  } catch (error) {
    throw new Error(`This browser could not decode ${file.name}. Try MP3 or WAV. ${error instanceof Error ? error.message : ''}`.trim());
  } finally {
    await context.close();
  }
}

const stageText: Record<SeparationProgress['stage'], string> = {
  [SeparationStage.LoadingModel]: 'Loading the local AI model',
  [SeparationStage.Demixing]: 'Removing vocals',
  [SeparationStage.WritingOutput]: 'Preparing WAV downloads',
};

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
        const chunk = progress.chunk && progress.totalChunks ? ` · ${progress.chunk}/${progress.totalChunks}` : '';
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
  if (urls.length !== 2) throw new Error('The separator did not return both expected stems.');
  return { vocalsUrl: urls[0], instrumentalUrl: urls[1] };
}
