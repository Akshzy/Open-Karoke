import { describe, expect, it } from 'vitest';
import { monoResample } from './draftLyrics';

describe('local lyric audio preparation', () => {
  it('mixes channels and resamples without changing Unicode lyric state', () => {
    const output = monoResample([new Float32Array([1, 0, -1, 0]), new Float32Array([0, 1, 0, -1])], 4, 2);
    expect(Array.from(output)).toEqual([0.5, -0.5]);
  });

  it('handles empty audio safely', () => {
    expect(monoResample([], 44_100)).toHaveLength(0);
  });
});
