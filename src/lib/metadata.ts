export interface FilenameMetadata {
  originalTitle: string;
  title: string;
  artist: string;
}

const LABELS = /\b(?:official\s*)?(?:music\s*)?(?:videos?|audios?|lyrics?(?:\s+videos?)?|songs?)|\b(?:4k|8k|uhd|full\s*hd|hd|hq|1080p|720p|320kbps|remaster(?:ed)?|karaoke)\b/gi;
const MEDIA_SUFFIX = /\s+(?:(?:4k|8k|uhd|full\s*hd|hd|hq|1080p|720p)\s+)(?:enhanced\s+)?(?:official\s+)?(?:music\s+)?(?:videos?|audios?|lyrics?(?:\s+videos?)?|songs?)\b.*$/i;
const LEADING_MEDIA_LABEL = /^(?:(?:full|official|4k|8k|uhd|hd|hq|1080p|720p)\s+)*(?:music\s+)?(?:videos?|audios?|lyrics?(?:\s+videos?)?|songs?)\b/i;

function cleanPart(value: string) {
  return value
    .replace(MEDIA_SUFFIX, ' ')
    .replace(/\([^)]*(?:official|video|audio|lyric|4k|8k|uhd|hd|1080p|720p|remaster|karaoke)[^)]*\)/gi, ' ')
    .replace(/\[[^\]]*(?:official|video|audio|lyric|4k|8k|uhd|hd|1080p|720p|remaster|karaoke)[^\]]*\]/gi, ' ')
    .replace(LABELS, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/[|•]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s–—-]+|[\s–—-]+$/g, '')
    .trim();
}

export function metadataFromFilename(fileName: string): FilenameMetadata {
  const originalTitle = fileName.replace(/\.[^.]+$/, '').trim();
  const primary = originalTitle.split('|')[0]?.trim() || originalTitle;
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(primary);
  if (dash) {
    if (LEADING_MEDIA_LABEL.test(dash[2])) {
      return { originalTitle, title: cleanPart(dash[1]) || originalTitle, artist: '' };
    }
    const artist = cleanPart(dash[1]);
    const title = cleanPart(dash[2]);
    if (artist && title) return { originalTitle, title, artist };
  }
  return { originalTitle, title: cleanPart(primary) || originalTitle, artist: '' };
}
