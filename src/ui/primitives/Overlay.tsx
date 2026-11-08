import { Image, type ImageProps } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveImage } from '../images';
import { useTheme } from '../theme/theme';
import { useKeyboardHeight } from '../useKeyboard';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** An image with a themed placeholder and a fallback icon when there is no source or it fails. */
export function Photo({
  uri,
  style,
  fallbackIcon = 'restaurant',
  contentFit = 'cover',
  transition = 180,
  ...rest
}: Omit<ImageProps, 'source' | 'style'> & {
  uri?: string;
  style?: StyleProp<ViewStyle>;
  fallbackIcon?: IconName;
}) {
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string | undefined>(undefined);
  const failed = !!uri && failedUri === uri;
  const source = resolveImage(uri);
  return (
    <View style={[{ backgroundColor: colors.imagePlaceholder, overflow: 'hidden' }, style]}>
      {source && !failed ? (
        <Image
          source={source as ImageProps['source']}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={transition}
          onError={() => setFailedUri(uri)}
          {...rest}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name={fallbackIcon} size={28} tone="tertiary" />
        </View>
      )}
    </View>
  );
}

/**
 * Bottom sheet on phones, centered card on wide screens. Content scrolls;
 * the header carries a title and close button.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  scroll = true,
  headerRight,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  headerRight?: ReactNode;
}) {
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 720;
  const keyboard = useKeyboardHeight();
  const [progress] = useState(() => new Animated.Value(0));

  // The Modal fades the backdrop in and out; the sheet itself slides up on open.
  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [wide ? 24 : height * 0.6, 0] });
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ paddingHorizontal: space.lg, flexShrink: 1 }}>{children}</View>
  );

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" />
        </View>
        {/* The keyboard pushes the sheet up rather than covering its fields. */}
        <View
          style={[styles.fill, wide ? styles.centerWide : styles.bottom, { paddingBottom: keyboard }]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                borderBottomLeftRadius: wide ? radius.xl : 0,
                borderBottomRightRadius: wide ? radius.xl : 0,
                maxHeight: Math.min(wide ? height * 0.85 : height * 0.92, height - keyboard - insets.top - 8),
                width: wide ? Math.min(560, width - 48) : '100%',
                paddingBottom: wide || keyboard ? space.lg : Math.max(insets.bottom, space.lg),
                transform: [{ translateY }],
              },
            ]}
          >
            {!wide ? <View style={[styles.grabber, { backgroundColor: colors.fillStrong }]} /> : null}
            <View style={[styles.header, { paddingHorizontal: space.lg, paddingVertical: space.md }]}>
              <Text variant="title3" style={styles.headerTitle} numberOfLines={1}>
                {title ?? ''}
              </Text>
              {headerRight}
              <IconButton
                icon="close"
                variant="fill"
                size={30}
                onPress={onClose}
                accessibilityLabel="Close"
              />
            </View>
            {body}
            {footer ? (
              <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>{footer}</View>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bottom: { justifyContent: 'flex-end' },
  centerWide: { justifyContent: 'center', alignItems: 'center' },
  grabber: { width: 38, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { flex: 1 },
});
