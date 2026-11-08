import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export type TapProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Light haptic tick on press (no-op on web). */
  haptic?: boolean;
  /** Visual press feedback: dim (default), scale, or none. */
  feedback?: 'dim' | 'scale' | 'none';
};

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light'): void {
  if (Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else
    void Haptics.impactAsync(
      kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
}

/** Pressable with consistent press feedback across the app. */
export function Tap({ style, haptic: withHaptic, feedback = 'dim', onPress, ...rest }: TapProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onPress={(e) => {
        if (withHaptic) haptic();
        onPress?.(e);
      }}
      style={(state) => {
        const base = typeof style === 'function' ? style(state) : style;
        const pressedStyle: ViewStyle | null = state.pressed
          ? feedback === 'dim'
            ? { opacity: 0.6 }
            : feedback === 'scale'
              ? { transform: [{ scale: 0.97 }], opacity: 0.92 }
              : null
          : null;
        return [base, pressedStyle, Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null];
      }}
    />
  );
}
