import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';

export function Card({
  children,
  style,
  padded = true,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
}) {
  const { colors, radius, space } = useTheme();
  const cardStyle = [
    { backgroundColor: colors.surface, borderRadius: radius.lg, padding: padded ? space.lg : 0, overflow: 'hidden' as const },
    style,
  ];
  if (onPress) {
    return (
      <Tap feedback="scale" onPress={onPress} style={cardStyle}>
        {children}
      </Tap>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

/** Inset grouped list section, as in iOS Settings. */
export function ListSection({
  title,
  footer,
  children,
  style,
  action,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  action?: ReactNode;
}) {
  const { colors, radius, space } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ marginBottom: space.xxl }, style]}>
      {title || action ? (
        <View style={[styles.sectionHeader, { paddingHorizontal: space.lg, marginBottom: space.sm }]}>
          {title ? (
            <Text variant="footnote" tone="secondary" weight="600" style={styles.upper}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View style={[styles.separator, { backgroundColor: colors.separator, marginLeft: space.lg }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="footnote" tone="secondary" style={{ paddingHorizontal: space.lg, marginTop: space.sm }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  onPress,
  accessory = onPress ? 'chevron' : 'none',
  switchValue,
  onSwitch,
  destructive,
  right,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  iconColor?: string;
  onPress?: () => void;
  accessory?: 'chevron' | 'check' | 'none' | 'switch';
  switchValue?: boolean;
  onSwitch?: (value: boolean) => void;
  destructive?: boolean;
  right?: ReactNode;
}) {
  const { colors, space, radius } = useTheme();
  const content = (
    <View style={[styles.row, { paddingHorizontal: space.lg, minHeight: 50, paddingVertical: subtitle ? space.sm : 0 }]}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: iconColor ?? colors.accent, borderRadius: radius.xs + 1 }]}>
          <Icon name={icon} size={17} color="#FFFFFF" />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text variant="body" tone={destructive ? 'danger' : 'primary'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" tone="secondary" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {right}
      {accessory === 'chevron' ? <Icon name="chevron" size={18} tone="tertiary" /> : null}
      {accessory === 'check' ? <Icon name="check" size={20} tone="accent" /> : null}
      {accessory === 'switch' ? (
        <Switch value={!!switchValue} onValueChange={onSwitch} trackColor={{ true: colors.accent, false: colors.fillStrong }} />
      ) : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Tap onPress={onPress} feedback="dim">
      {content}
    </Tap>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  upper: { textTransform: 'uppercase', letterSpacing: 0.4 },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
  value: { maxWidth: '45%' },
});
