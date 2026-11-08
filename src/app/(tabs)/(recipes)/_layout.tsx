import { Stack } from 'expo-router';

import { useTheme } from '@/ui';

/**
 * The Recipes tab is a stack rooted at Collections, with All Recipes opened on
 * top of it, so "‹ Collections" goes back up, as in Crouton. Deep links get
 * Collections underneath from the anchor; native cold starts push All Recipes
 * from CollectionsScreen, without animation (the `launch` param).
 */
export const unstable_settings = { anchor: 'collections' };

export default function RecipesStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen
        name="index"
        options={({ route }) => ({ animation: (route.params as { launch?: string } | undefined)?.launch ? 'none' : 'default' })}
      />
    </Stack>
  );
}
