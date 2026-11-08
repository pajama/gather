import type { ImageSourcePropType } from 'react-native';

/**
 * Some image URIs are app-internal: bundled sample photos (`asset://seed/pancakes`)
 * and photos kept in app storage (`photo://…`). The app registers resolvers at
 * startup, so the UI layer stays free of feature and data imports.
 */
type Resolver = (uri: string) => ImageSourcePropType | number | undefined;

const resolvers: Resolver[] = [];

/** Adds a resolver; the first one that returns a source wins. */
export function addImageResolver(resolver: Resolver): void {
  resolvers.push(resolver);
}

export function resolveImage(uri: string | undefined): ImageSourcePropType | number | { uri: string } | undefined {
  if (!uri) return undefined;
  // App-internal schemes resolve through the registered resolvers, or not at all.
  if (/^[a-z]+:\/\//i.test(uri) && !/^(https?|file|content|blob|ph|assets-library):/i.test(uri)) {
    for (const resolver of resolvers) {
      const source = resolver(uri);
      if (source !== undefined) return source;
    }
    return undefined;
  }
  return { uri };
}
