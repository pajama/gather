import { StyleSheet, View } from 'react-native';

import { haptic, Icon, Tap, useTheme } from '@/ui';

/**
 * Five stars; tapping the current rating again clears it. For screen readers
 * the row is one adjustable control (swipe up or down to change the rating).
 */
export function RatingStars({
  value,
  onChange,
  size = 20,
}: {
  value: number | undefined;
  onChange?: (rating: number | undefined) => void;
  size?: number;
}) {
  const { colors } = useTheme();
  const rating = value ?? 0;
  const label = rating ? `${rating} of 5 stars` : 'Not rated';
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole={onChange ? 'adjustable' : 'image'}
      accessibilityLabel={onChange ? 'Rating' : label}
      {...(onChange
        ? {
            accessibilityValue: { min: 0, max: 5, now: rating, text: label },
            accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
            onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
              const next =
                event.nativeEvent.actionName === 'increment'
                  ? Math.min(5, rating + 1)
                  : Math.max(0, rating - 1);
              if (next !== rating) onChange(next === 0 ? undefined : next);
            },
          }
        : {})}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <Icon
            name={n <= rating ? 'star' : 'starOutline'}
            size={size}
            color={n <= rating ? colors.yellow : colors.textTertiary}
          />
        );
        return onChange ? (
          <Tap
            key={n}
            hitSlop={4}
            onPress={() => {
              haptic();
              onChange(n === rating ? undefined : n);
            }}
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
          >
            {star}
          </Tap>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
