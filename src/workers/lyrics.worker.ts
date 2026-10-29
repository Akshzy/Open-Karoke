import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

interface DetectRequest {
  audio: Float32Array;
  language: string;
  useWebGpu: boolean;
}

interface ModelProgress {
  status?: string;
  file?: string;
  progress?: number;
}

interface TimestampChunk {
  text: string;
  timestamp: [number | null, number | null];
}

type TranscriptionResult = { text: string; chunks?: TimestampChunk[] };
type Transcriber = (audio: Float32Array, options: Record<string, unknown>) => Promise<TranscriptionResult | TranscriptionResult[]>;
let transcriber: Transcriber | null = null;

self.onmessage = async (event: MessageEvent<DetectRequest>) => {
  try {
    if (!transcriber) {
      const createTranscriber = pipeline as unknown as (task: string, model: string, options: Record<string, unknown>) => Promise<Transcriber>;
      transcriber = await createTranscriber('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
        device: event.data.useWebGpu ? 'webgpu' : 'wasm',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        progress_callback(progress: ModelProgress) {
          self.postMessage({ type: 'progress', detail: progress.file ? `${progress.status ?? 'Loading'} · ${progress.file}` : progress.status ?? 'Loading model', fraction: (progress.progress ?? 0) / 100 });
        },
      });
    }
    self.postMessage({ type: 'progress', detail: 'Listening to the isolated vocals locally', fraction: 0.98 });
    const result = await transcriber(event.data.audio, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe',
      ...(event.data.language ? { language: event.data.language } : {}),
    });
    const output = Array.isArray(result) ? result[0] : result;
    const chunks = ((output as { chunks?: TimestampChunk[] }).chunks ?? [])
      .filter((chunk) => chunk.text.trim() && Number.isFinite(chunk.timestamp[0]))
      .map((chunk) => ({ text: chunk.text.trim(), start: chunk.timestamp[0] as number, end: Number.isFinite(chunk.timestamp[1]) ? chunk.timestamp[1] as number : undefined }));
    self.postMessage({ type: 'result', chunks });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
