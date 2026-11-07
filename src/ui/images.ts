import type { ImageSourcePropType } from 'react-native';

/**
 * Some image URIs are app-internal (bundled sample photos: `asset://seed/pancakes`).
 * The app registers a resolver at startup; the UI layer stays free of feature imports.
 */
type Resolver = (uri: string) => ImageSourcePropType | number | undefined;

let resolver: Resolver = () => undefined;

export function setImageResolver(next: Resolver): void {
  resolver = next;
}

export function resolveImage(uri: string | undefined): ImageSourcePropType | number | { uri: string } | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('asset://')) return resolver(uri);
  return { uri };
}
