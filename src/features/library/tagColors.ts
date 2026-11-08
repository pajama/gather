import { useCallback } from 'react';

import { useSettings } from '@/data/react';

/** Tag colors to pick from, in Crouton's spirit. */
export const TAG_COLORS = ['#A050E0', '#3D8EF0', '#34C759', '#F5A623', '#FF2D55', '#20A889', '#5E5CE6', '#FF9500'];

/** A color derived from the tag name, used until someone picks one. */
export function tagColor(tag: string): string {
  let hash = 0;
  for (const ch of tag.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length]!;
}

/** Resolves tag colors, honoring the ones picked in Collections. */
export function useTagColor(): (tag: string) => string {
  const picked = useSettings().tagColors;
  return useCallback((tag: string) => picked?.[tag.toLowerCase()] ?? tagColor(tag), [picked]);
}
