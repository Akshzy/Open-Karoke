import { describe, expect, it } from 'vitest';
import type { LyricLine } from '../types';
import { dimensions, drawKaraokeFrame } from './video';

function recordingContext() {
  const text: string[] = [];
  const fills: { value: string; color: string }[] = [];
  const context = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    fillText(this: { fillStyle: string }, value: string) { text.push(value); fills.push({ value, color: this.fillStyle }); },
    measureText(value: string) { return { width: value.length * 18 }; },
  } as unknown as CanvasRenderingContext2D;
  return { context, text, fills };
}

describe('karaoke video frames', () => {
  it('uses the requested portrait and landscape dimensions', () => {
    expect(dimensions('portrait')).toEqual({ width: 720, height: 1280 });
    expect(dimensions('landscape')).toEqual({ width: 1280, height: 720 });
  });

  it('draws the correctly timed Indic current and next lines without altering text', () => {
    const lines: LyricLine[] = [
      { id: '1', time: 1, text: 'നമസ്കാരം ലോകമേ' },
      { id: '2', time: 3, text: 'வணக்கம் உலகம்' },
      { id: '3', time: 5, text: 'नमस्ते दुनिया' },
    ];
    const { context, text } = recordingContext();

    drawKaraokeFrame(context, 720, 1280, 'Indic timing test', lines, 2.8, 0.3);

    expect(text).toContain('வணக்கம் உலகம்');
    expect(text).toContain('नमस्ते दुनिया');
    expect(text).not.toContain('നമസ്കാരം ലോകമേ');
  });

  it('uses exact word timing and offset when rendering exported frames', () => {
    const lines: LyricLine[] = [{
      id: 'word', time: 1, text: 'നമസ്കാരം ലോകമേ',
      words: [
        { text: 'നമസ്കാരം ', startTime: 1, endTime: 2 },
        { text: 'ലോകമേ', startTime: 2, endTime: 3 },
      ],
    }];
    const { context, fills } = recordingContext();
    drawKaraokeFrame(context, 720, 1280, 'Word sync', lines, 1.8, 0.3);
    expect(fills).toContainEqual({ value: 'നമസ്കാരം ', color: '#d7ff52' });
    expect(fills).toContainEqual({ value: 'ലോകമേ', color: '#d7ff52' });
  });
});
