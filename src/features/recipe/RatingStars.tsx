import { StyleSheet, View } from 'react-native';

import { haptic, Icon, Tap, useTheme } from '@/ui';

/** Five stars; tapping the current rating again clears it. */
export function RatingStars({ value, onChange, size = 20 }: { value: number | undefined; onChange?: (rating: number | undefined) => void; size?: number }) {
  const { colors } = useTheme();
  const rating = value ?? 0;
  return (
    <View style={styles.row} accessibilityRole={onChange ? 'adjustable' : 'image'} accessibilityLabel={rating ? `Rated ${rating} of 5` : 'Not rated'}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = <Icon name={n <= rating ? 'star' : 'starOutline'} size={size} color={n <= rating ? colors.yellow : colors.textTertiary} />;
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
