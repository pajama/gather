 
import { setImageResolver } from '@/ui/images';

const SEED_IMAGES: Record<string, number> = {
  'roast-chicken': require('../../../assets/seed/roast-chicken.jpg'),
  'tomato-pasta': require('../../../assets/seed/tomato-pasta.jpg'),
  pancakes: require('../../../assets/seed/pancakes.jpg'),
  'green-curry': require('../../../assets/seed/green-curry.jpg'),
  cookies: require('../../../assets/seed/cookies.jpg'),
  shakshuka: require('../../../assets/seed/shakshuka.jpg'),
  'miso-salmon': require('../../../assets/seed/miso-salmon.jpg'),
  panzanella: require('../../../assets/seed/panzanella.jpg'),
};

export function registerSeedImages(): void {
  setImageResolver((uri) => {
    const match = /^asset:\/\/seed\/(.+)$/.exec(uri);
    return match ? SEED_IMAGES[match[1]!] : undefined;
  });
}
