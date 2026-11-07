import { Image, type ImageProps } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
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
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  // Mount as soon as the sheet opens; unmount only after the close animation.
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }

  useEffect(() => {
    Animated.timing(progress, { toValue: visible ? 1 : 0, duration: visible ? 260 : 200, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished && !visible) setMounted(false);
      },
    );
  }, [visible, progress]);

  if (!mounted) return null;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [wide ? 24 : height * 0.6, 0] });
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={{ paddingHorizontal: space.lg, flexShrink: 1 }}>{children}</View>
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <View style={[styles.fill, wide ? styles.centerWide : styles.bottom]} pointerEvents="box-none">
          <Animated.View
            style={[
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                borderBottomLeftRadius: wide ? radius.xl : 0,
                borderBottomRightRadius: wide ? radius.xl : 0,
                maxHeight: wide ? height * 0.85 : height * 0.92,
                width: wide ? Math.min(560, width - 48) : '100%',
                paddingBottom: wide ? space.lg : Math.max(insets.bottom, space.lg),
                transform: [{ translateY }],
                opacity: wide ? progress : 1,
              },
            ]}
          >
            {!wide ? <View style={[styles.grabber, { backgroundColor: colors.fillStrong }]} /> : null}
            <View style={[styles.header, { paddingHorizontal: space.lg, paddingVertical: space.md }]}>
              <Text variant="title3" style={styles.headerTitle} numberOfLines={1}>
                {title ?? ''}
              </Text>
              {headerRight}
              <IconButton icon="close" variant="fill" size={30} onPress={onClose} accessibilityLabel="Close" />
            </View>
            {body}
            {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>{footer}</View> : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
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
