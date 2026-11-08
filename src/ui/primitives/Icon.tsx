import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '../theme/theme';

/**
 * Semantic icon names. Screens use these, never raw glyph names, so the
 * icon set can change in one place.
 */
const GLYPHS = {
  add: 'add',
  close: 'close',
  back: 'chevron-back',
  chevron: 'chevron-forward',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  search: 'search',
  heart: 'heart',
  heartOutline: 'heart-outline',
  star: 'star',
  starOutline: 'star-outline',
  time: 'time-outline',
  people: 'people-outline',
  play: 'play',
  pause: 'pause',
  stop: 'stop',
  cart: 'cart-outline',
  cartFilled: 'cart',
  calendar: 'calendar-outline',
  calendarFilled: 'calendar',
  book: 'book-outline',
  bookFilled: 'book',
  settings: 'settings-outline',
  settingsFilled: 'settings',
  share: 'share-outline',
  edit: 'create-outline',
  trash: 'trash-outline',
  folder: 'folder-outline',
  folderFilled: 'folder',
  link: 'link-outline',
  camera: 'camera-outline',
  image: 'image-outline',
  timer: 'timer-outline',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  circle: 'ellipse-outline',
  more: 'ellipsis-horizontal',
  list: 'list',
  grid: 'grid-outline',
  copy: 'copy-outline',
  text: 'document-text-outline',
  sparkles: 'sparkles-outline',
  flame: 'flame-outline',
  leaf: 'leaf-outline',
  eye: 'eye-outline',
  minus: 'remove',
  sort: 'swap-vertical',
  filter: 'funnel-outline',
  globe: 'globe-outline',
  restaurant: 'restaurant-outline',
  nutrition: 'nutrition-outline',
  refresh: 'refresh',
  undo: 'arrow-undo-outline',
  shuffle: 'shuffle',
  download: 'download-outline',
  upload: 'cloud-upload-outline',
  moon: 'moon-outline',
  sun: 'sunny-outline',
  palette: 'color-palette-outline',
  scale: 'scale-outline',
  notes: 'reader-outline',
  clipboard: 'clipboard-outline',
  drag: 'reorder-three',
  info: 'information-circle-outline',
  checklist: 'checkbox-outline',
  expand: 'expand-outline',
  print: 'print-outline',
  arrowLeft: 'arrow-back',
  arrowRight: 'arrow-forward',
  bulb: 'bulb-outline',
  basket: 'basket-outline',
  basketFilled: 'basket',
  recipes: 'newspaper-outline',
  recipesFilled: 'newspaper',
  sparklesFilled: 'sparkles',
  moreCircle: 'ellipsis-horizontal-circle-outline',
  moreCircleFilled: 'ellipsis-horizontal-circle',
  send: 'paper-plane',
  sliders: 'options-outline',
  timerAdd: 'timer-outline',
  grid3: 'apps-outline',
  folderOpen: 'folder-open-outline',
  ellipse: 'ellipse',
  pizza: 'pizza-outline',
  cafe: 'cafe-outline',
  fish: 'fish-outline',
  egg: 'egg-outline',
  ice: 'snow-outline',
  wine: 'wine-outline',
  home: 'home-outline',
  bag: 'bag-handle-outline',
  bowl: 'restaurant-outline',
  sunny: 'sunny-outline',
  partlySunny: 'partly-sunny-outline',
  moonNight: 'moon-outline',
  sync: 'sync-outline',
  lock: 'lock-closed-outline',
  alert: 'alert-circle-outline',
  bookmark: 'bookmark-outline',
  pricetag: 'pricetag-outline',
  volume: 'volume-high-outline',
  hand: 'hand-left-outline',
  compass: 'compass-outline',
  compassFilled: 'compass',
  newspaper: 'newspaper-outline',
  mic: 'mic-outline',
  micOff: 'mic-off-outline',
} as const satisfies Record<string, ComponentProps<typeof Ionicons>['name']>;

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  size = 22,
  color,
  tone = 'primary',
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  tone?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger' | 'onImage';
}) {
  const { colors } = useTheme();
  const toneColor = {
    primary: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.accent,
    onAccent: colors.onAccent,
    danger: colors.danger,
    onImage: colors.textOnImage,
  }[tone];
  // Icons are decoration: the control around them carries the label. Without this, screen readers
  // read the glyph's private-use character as part of every row and button.
  return (
    <Ionicons
      name={GLYPHS[name]}
      size={size}
      color={(color ?? toneColor) as string}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    />
  );
}
