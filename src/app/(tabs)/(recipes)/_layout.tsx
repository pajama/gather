import { Stack } from 'expo-router';

import { useTheme } from '@/ui';

/**
 * The Recipes tab is a stack rooted at Collections. Opening the tab lands on
 * All Recipes with Collections underneath, so "‹ Collections" goes back up,
 * as in Crouton.
 */
export const unstable_settings = { initialRouteName: 'collections' };

export default function RecipesStack() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
