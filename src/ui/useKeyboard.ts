import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How far the on-screen keyboard reaches up from the bottom of the screen, 0
 * while it is hidden (always 0 on the web). Android 15 draws apps edge to
 * edge, so the window no longer shrinks for the keyboard: anything anchored to
 * the bottom has to move up by this much itself. React Native reports Android
 * keyboard heights without the navigation bar under them, so that is added back.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e: KeyboardEvent) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height > 0 && Platform.OS === 'android' ? height + bottom : height;
}
