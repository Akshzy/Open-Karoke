import type { LyricLine } from '../types';

export type DraftLanguage = '' | 'malayalam' | 'tamil' | 'hindi' | 'english';

export interface DraftProgress {
  detail: string;
  fraction: number;
}

export function monoResample(channels: Float32Array[], sourceRate: number, targetRate = 16_000) {
  if (!channels.length || !channels[0].length || sourceRate <= 0 || targetRate <= 0) return new Float32Array();
  const sourceLength = channels[0].length;
  const targetLength = Math.max(1, Math.round(sourceLength * targetRate / sourceRate));
  const output = new Float32Array(targetLength);
  for (let index = 0; index < targetLength; index += 1) {
    const sourcePosition = index * sourceRate / targetRate;
    const lower = Math.min(sourceLength - 1, Math.floor(sourcePosition));
    const upper = Math.min(sourceLength - 1, lower + 1);
    const fraction = sourcePosition - lower;
    let sample = 0;
    for (const channel of channels) sample += channel[lower] + (channel[upper] - channel[lower]) * fraction;
    output[index] = sample / channels.length;
  }
  return output;
}

async function decodeForWhisper(audioUrl: string, signal: AbortSignal) {
  const response = await fetch(audioUrl, { signal });
  if (!response.ok) throw new Error('The isolated-vocal audio could not be read.');
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    return monoResample(Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index)), buffer.sampleRate);
  } finally {
    await context.close();
  }
}

export async function detectDraftLyrics(
  audioUrl: string,
  language: DraftLanguage,
  onProgress: (progress: DraftProgress) => void,
  signal: AbortSignal,
): Promise<LyricLine[]> {
  onProgress({ detail: 'Preparing isolated vocals', fraction: 0.01 });
  const audio = await decodeForWhisper(audioUrl, signal);
  if (!audio.length) throw new Error('The isolated-vocal audio is empty.');
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');

  const worker = new Worker(new URL('../workers/lyrics.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const stop = () => {
      worker.terminate();
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', stop, { once: true });
    worker.onerror = (event) => {
      signal.removeEventListener('abort', stop);
      worker.terminate();
      reject(new Error(event.message || 'Local lyric detection failed.'));
    };
    worker.onmessage = (event: MessageEvent<{ type: string; detail?: string; fraction?: number; message?: string; chunks?: Array<{ text: string; start: number; end?: number }> }>) => {
      if (event.data.type === 'progress') {
        onProgress({ detail: event.data.detail ?? 'Detecting draft lyrics', fraction: Math.max(0.02, Math.min(0.99, event.data.fraction ?? 0.02)) });
        return;
      }
      signal.removeEventListener('abort', stop);
      worker.terminate();
      if (event.data.type === 'error') { reject(new Error(event.data.message ?? 'Local lyric detection failed.')); return; }
      const lines = (event.data.chunks ?? []).map((chunk, index) => ({
        id: `draft-${index}`,
        time: chunk.start,
        endTime: chunk.end,
        text: chunk.text,
        timed: true,
      }));
      if (!lines.length) { reject(new Error('No timed lyric phrases were detected. Try selecting the language or use LRC/manual timing.')); return; }
      resolve(lines);
    };
    worker.postMessage({ audio, language, useWebGpu: 'gpu' in navigator }, [audio.buffer]);
  });
}
