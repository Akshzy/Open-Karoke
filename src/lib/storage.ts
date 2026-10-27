import type { LyricLine, VideoAspect } from '../types';

const KEY = 'openkaraoke-project-v1';

export interface SavedProject {
  title: string;
  fileName: string;
  lyrics: LyricLine[];
  offset: number;
  aspect: VideoAspect;
  savedAt: string;
}

export function saveProject(project: SavedProject) {
  localStorage.setItem(KEY, JSON.stringify(project));
}

export function loadProject(): SavedProject | null {
  try {
    const value = localStorage.getItem(KEY);
    return value ? (JSON.parse(value) as SavedProject) : null;
  } catch {
    return null;
  }
}
