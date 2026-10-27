export type WorkflowStep = 1 | 2 | 3;

export interface LyricLine {
  id: string;
  time: number;
  text: string;
  timed?: boolean;
  endTime?: number;
  words?: LyricWord[];
}

export interface LyricWord {
  text: string;
  startTime: number;
  endTime?: number;
}

export interface SongState {
  file: File;
  originalTitle: string;
  title: string;
  artist: string;
  duration: number;
  originalUrl: string;
  instrumentalUrl?: string;
  vocalsUrl?: string;
}

export type SeparationPhase = 'idle' | 'loading-model' | 'demixing' | 'writing-output' | 'done' | 'cancelled' | 'error';

export interface SeparationStatus {
  phase: SeparationPhase;
  fraction: number;
  detail: string;
  backend: 'WebGPU' | 'WASM';
  error?: string;
}

export type VideoAspect = 'portrait' | 'landscape';
