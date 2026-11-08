import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider, useSettings } from '@/data/react';
import { seedDatabase } from '@/features/onboarding/seed';
import { registerSeedImages } from '@/features/onboarding/seed-images';
import { TimersProvider } from '@/features/cook/timers';
import { ThemeProvider, useTheme } from '@/ui';

registerSeedImages();
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppStack() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]/index" />
        <Stack.Screen name="recipe/[id]/cook" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="recipe/[id]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipe/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

function ThemedApp() {
  const settings = useSettings();
  return (
    <ThemeProvider accent={settings.accent} preference={settings.theme}>
      <TimersProvider>
        <AppStack />
      </TimersProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <DatabaseProvider seed={seedDatabase}>
          <ThemedApp />
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
