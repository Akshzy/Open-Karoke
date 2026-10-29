import { describe, expect, it } from 'vitest';
import { mapMdxStemUrls } from './audio';

describe('MDX stem mapping', () => {
  it('maps the instrumental-primary karaoke model without swapping stems', () => {
    expect(mapMdxStemUrls(['derived-vocals', 'primary-instrumental'], 'instrumental')).toEqual({
      vocalsUrl: 'derived-vocals', instrumentalUrl: 'primary-instrumental',
    });
  });

  it('selects the primary vocal output from the optional vocal-focused model', () => {
    expect(mapMdxStemUrls(['derived-instrumental', 'primary-vocals'], 'vocals')).toEqual({
      instrumentalUrl: 'derived-instrumental', vocalsUrl: 'primary-vocals',
    });
  });
});
