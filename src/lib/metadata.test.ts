import { describe, expect, it } from 'vitest';
import { metadataFromFilename } from './metadata';

describe('filename metadata', () => {
  it('removes extensions, video labels, and quality tags while preserving the original', () => {
    expect(metadataFromFilename('I Hate You 4K Video Song | Happy Be Happy | Allu Arjun.mp4')).toEqual({
      originalTitle: 'I Hate You 4K Video Song | Happy Be Happy | Allu Arjun',
      title: 'I Hate You',
      artist: '',
    });
  });

  it('extracts editable artist and title from a conventional filename', () => {
    expect(metadataFromFilename('Vidhu Prathap - മനസ്സിൽ [Official Lyric Video] 1080p.mp3')).toEqual({
      originalTitle: 'Vidhu Prathap - മനസ്സിൽ [Official Lyric Video] 1080p',
      title: 'മനസ്സിൽ',
      artist: 'Vidhu Prathap',
    });
  });

  it('stops at a quality-prefixed media label instead of treating credits as the title', () => {
    expect(metadataFromFilename('Mohajalakam 4K Enhanced Video Song Aarya 2 Vidhu Prathap DSP Hi-Fi Songs.mp3')).toEqual({
      originalTitle: 'Mohajalakam 4K Enhanced Video Song Aarya 2 Vidhu Prathap DSP Hi-Fi Songs',
      title: 'Mohajalakam',
      artist: '',
    });
  });

  it('does not mistake a title followed by a full-video description for artist-title metadata', () => {
    expect(metadataFromFilename("Mazhavillaye - Full Video I'm Game (Malayalam) Dulquer Salmaan,Kayadu Armaan Malik,Jakes Bejoy.mp3")).toEqual({
      originalTitle: "Mazhavillaye - Full Video I'm Game (Malayalam) Dulquer Salmaan,Kayadu Armaan Malik,Jakes Bejoy",
      title: 'Mazhavillaye',
      artist: '',
    });
  });
});
