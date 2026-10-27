import {
  AudioBufferSource,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Input,
  Output,
  Quality,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import type { LyricLine, VideoAspect } from '../types';
import { lyricDisplayState, wordHighlightState } from './lrc';

const FONT_STACK = '"Noto Sans Malayalam", "Noto Sans Tamil", "Noto Sans Devanagari", "Nirmala UI", Latha, Mangal, system-ui, sans-serif';

export async function mp4Support(aspect: VideoAspect) {
  const { width, height } = dimensions(aspect);
  if (!('VideoEncoder' in window) || !('AudioEncoder' in window)) return false;
  const [video, audio] = await Promise.all([
    canEncodeVideo('avc', { width, height, frameRate: 10 }),
    canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 44100 }),
  ]);
  return video && audio;
}

export function dimensions(aspect: VideoAspect) {
  return aspect === 'portrait' ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}

export interface Mp4Validation {
  mimeType: string;
  videoCodec: string;
  audioCodec: string;
  duration: number;
}

export async function validateKaraokeMp4(blob: Blob, expectedDuration: number): Promise<Mp4Validation> {
  if (blob.type !== 'video/mp4' || blob.size < 1024) throw new Error('The encoder did not produce a valid MP4 blob.');
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    if (!(await input.canRead())) throw new Error('The generated MP4 cannot be parsed.');
    const [mimeType, video, audio, duration] = await Promise.all([
      input.getMimeType(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
      input.computeDuration(),
    ]);
    if (!video || !audio) throw new Error('The generated MP4 is missing its video or audio track.');
    const [videoCodec, audioCodec, videoDecodable, audioDecodable] = await Promise.all([
      video.getCodec(), audio.getCodec(), video.canDecode(), audio.canDecode(),
    ]);
    if (videoCodec !== 'avc' || audioCodec !== 'aac') {
      throw new Error(`Unexpected MP4 codecs (${videoCodec ?? 'none'} / ${audioCodec ?? 'none'}).`);
    }
    if (!videoDecodable || !audioDecodable) throw new Error('This browser encoded the MP4 but cannot decode its tracks.');
    if (!Number.isFinite(duration) || Math.abs(duration - expectedDuration) > 0.25) {
      throw new Error(`MP4 duration mismatch (${duration.toFixed(2)}s vs ${expectedDuration.toFixed(2)}s).`);
    }
    return { mimeType, videoCodec, audioCodec, duration };
  } finally {
    input.dispose();
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (!text) return ['♪'];
  const words = text.split(/\s+/);
  const rows: string[] = [];
  let row = '';
  for (const word of words) {
    const candidate = row ? `${row} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !row) row = candidate;
    else {
      rows.push(row);
      row = word;
    }
  }
  if (row) rows.push(row);
  return rows.slice(0, 3);
}

function drawWordSyncedLine(
  ctx: CanvasRenderingContext2D,
  line: LyricLine,
  width: number,
  centerY: number,
  maxWidth: number,
  lineHeight: number,
  time: number,
  offset: number,
) {
  if (!line.words?.length) return false;
  const rows: NonNullable<LyricLine['words']>[] = [];
  let row: NonNullable<LyricLine['words']> = [];
  let rowWidth = 0;
  for (const word of line.words) {
    const wordWidth = ctx.measureText(word.text).width;
    if (row.length && rowWidth + wordWidth > maxWidth) { rows.push(row); row = []; rowWidth = 0; }
    row.push(word); rowWidth += wordWidth;
  }
  if (row.length) rows.push(row);
  const visible = rows.slice(0, 3);
  const startY = centerY - ((visible.length - 1) * lineHeight) / 2;
  ctx.textAlign = 'left';
  visible.forEach((words, rowIndex) => {
    const totalWidth = words.reduce((sum, word) => sum + ctx.measureText(word.text).width, 0);
    let x = width / 2 - totalWidth / 2;
    words.forEach((word, index) => {
      const state = wordHighlightState(word.startTime, word.endTime, words[index + 1]?.startTime, time, offset);
      ctx.fillStyle = state === 'future' ? '#f7f5ea' : '#d7ff52';
      ctx.fillText(word.text, x, startY + rowIndex * lineHeight);
      x += ctx.measureText(word.text).width;
    });
  });
  ctx.textAlign = 'center';
  return true;
}

export function drawKaraokeFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  lines: LyricLine[],
  time: number,
  offset: number,
) {
  ctx.fillStyle = '#171712';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#2a2a23';
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.16, Math.min(width, height) * 0.19, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d7ff52';
  ctx.beginPath();
  ctx.arc(width * 0.12, height * 0.8, Math.min(width, height) * 0.035, 0, Math.PI * 2);
  ctx.fill();

  const small = Math.max(22, Math.round(width * 0.028));
  ctx.font = `600 ${small}px ${FONT_STACK}`;
  ctx.fillStyle = '#b7b7aa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, height * 0.12, width * 0.82);

  const display = lyricDisplayState(lines, time, offset);
  const currentLine = display.currentIndex >= 0 ? lines[display.currentIndex] : undefined;
  const current = currentLine?.text ?? (display.kind === 'empty' ? 'No synchronized lyrics' : 'Instrumental');
  const next = display.nextIndex >= 0 ? lines[display.nextIndex]?.text ?? '' : '';
  const fontSize = Math.max(38, Math.round(width * (width > height ? 0.052 : 0.072)));
  ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
  ctx.fillStyle = '#f7f5ea';
  const lineHeight = fontSize * 1.28;
  if (!currentLine || !drawWordSyncedLine(ctx, currentLine, width, height * 0.49, width * 0.82, lineHeight, time, offset)) {
    const rows = wrapText(ctx, current, width * 0.82);
    const startY = height * 0.49 - ((rows.length - 1) * lineHeight) / 2;
    rows.forEach((row, index) => ctx.fillText(row, width / 2, startY + index * lineHeight));
  }

  if (next) {
    ctx.font = `500 ${Math.round(fontSize * 0.53)}px ${FONT_STACK}`;
    ctx.fillStyle = '#9c9c90';
    wrapText(ctx, next, width * 0.76).slice(0, 2).forEach((row, index) =>
      ctx.fillText(row, width / 2, height * 0.69 + index * fontSize * 0.62),
    );
  }

  const lastTimed = lines.filter((line) => line.timed !== false).reduce((maximum, line) => Math.max(maximum, line.time), 0);
  const progress = Math.max(0, Math.min(1, time / Math.max(lastTimed, time, 1)));
  ctx.fillStyle = '#3e3e36';
  ctx.fillRect(width * 0.12, height * 0.88, width * 0.76, Math.max(5, height * 0.006));
  ctx.fillStyle = '#d7ff52';
  ctx.fillRect(width * 0.12, height * 0.88, width * 0.76 * progress, Math.max(5, height * 0.006));
}

export async function exportKaraokeMp4(options: {
  audioUrl: string;
  title: string;
  lines: LyricLine[];
  offset: number;
  aspect: VideoAspect;
  signal: AbortSignal;
  onProgress: (fraction: number, detail: string) => void;
}) {
  const { width, height } = dimensions(options.aspect);
  if (!(await mp4Support(options.aspect))) throw new Error('This browser cannot encode the required H.264 + AAC MP4. Download audio and LRC instead.');
  await document.fonts.ready;
  const audioContext = new AudioContext({ sampleRate: 44100 });
  let output: Output<Mp4OutputFormat, BufferTarget> | undefined;
  try {
    const response = await fetch(options.audioUrl);
    const audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas rendering is unavailable.');
    const target = new BufferTarget();
    output = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target });
    const videoSource = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate: 1_800_000 }) });
    const audioSource = new AudioBufferSource({ codec: 'aac', quality: new Quality({ bitrate: 160_000 }) });
    output.addVideoTrack(videoSource, { frameRate: 10 });
    output.addAudioTrack(audioSource);
    output.setMetadataTags({ title: options.title, artist: 'Created locally with OpenKaraoke Studio' });
    await output.start();

    const frameRate = 10;
    const frameDuration = 1 / frameRate;
    const totalFrames = Math.max(1, Math.ceil(audioBuffer.duration * frameRate));
    const videoTask = (async () => {
      for (let frame = 0; frame < totalFrames; frame++) {
        if (options.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        const time = frame / frameRate;
        drawKaraokeFrame(ctx, width, height, options.title, options.lines, time, options.offset);
        await videoSource.add(time, Math.min(frameDuration, audioBuffer.duration - time));
        if (frame % 10 === 0) options.onProgress(frame / totalFrames, `Rendering frame ${frame + 1} of ${totalFrames}`);
      }
    })();
    await Promise.all([audioSource.add(audioBuffer), videoTask]);
    options.onProgress(0.98, 'Finalizing playable MP4');
    await output.finalize();
    if (!target.buffer) throw new Error('The encoder produced no output.');
    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    options.onProgress(0.99, 'Validating H.264, AAC, and timing');
    await validateKaraokeMp4(blob, audioBuffer.duration);
    return blob;
  } catch (error) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    await audioContext.close();
  }
}
