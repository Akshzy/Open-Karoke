import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SeparationStatus, SongState } from '../types';
import { UploadStep } from './UploadStep';

const song: SongState = {
  file: new File(['audio'], 'song.wav', { type: 'audio/wav' }),
  originalTitle: 'song',
  title: 'song',
  artist: '',
  duration: 120,
  originalUrl: 'blob:original',
};

function render(status: SeparationStatus) {
  return renderToStaticMarkup(<UploadStep
    song={song}
    status={status}
    onFile={vi.fn()}
    onSeparate={vi.fn()}
    onCancel={vi.fn()}
    onContinue={vi.fn()}
  />);
}

describe('song replacement safety', () => {
  it('blocks choosing another song while local separation owns the current audio', () => {
    const markup = render({ phase: 'demixing', fraction: 1 / 63, detail: 'Removing vocals · 1/63', backend: 'WebGPU' });
    expect(markup).toContain('Removing vocals · 1/63');
    expect(markup).toContain('aria-label="Wait for processing before choosing another song"');
    expect(markup).toContain('disabled=""');
  });

  it('allows replacement after processing finishes', () => {
    const markup = render({ phase: 'done', fraction: 1, detail: 'Instrumental ready', backend: 'WebGPU' });
    expect(markup).toContain('aria-label="Choose a different song"');
    expect(markup).not.toContain('aria-label="Choose a different song" disabled=""');
  });
});
