export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  extension: string;
  path: string;
  date: string;
  album: string;
  thumbnail?: string;
  duration?: string; // solo para videos
   durationSeconds?: number; // Para videos
  needsThumbnail?: boolean; // Para videos sin thumbnail
}
