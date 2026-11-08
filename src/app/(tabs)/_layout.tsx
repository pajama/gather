import { Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';

import { Sidebar } from '@/features/shell';
import { Icon, useAppLayout, useTheme, type IconName } from '@/ui';

function tabIcon(outline: IconName, filled: IconName) {
  // eslint-disable-next-line react/display-name
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={focused ? filled : outline} color={color} size={25} />
  );
}

/**
 * Tab order follows Crouton: Meal Plan, Recipes, Groceries, Discover, Settings.
 * "/" opens Recipes. Wide windows swap the tab bar for Crouton's iPad/Mac sidebar.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { hasSidebar } = useAppLayout();
  return (
    <Tabs
      tabBar={hasSidebar ? (props) => <Sidebar {...props} /> : undefined}
      screenOptions={{
        tabBarPosition: hasSidebar ? 'left' : 'bottom',
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8, paddingTop: 6 } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Nunito_600SemiBold' },
      }}
    >
      <Tabs.Screen
        name="plan"
        options={{ title: 'Meal Plan', tabBarIcon: tabIcon('calendar', 'calendarFilled') }}
      />
      <Tabs.Screen
        name="(recipes)"
        options={{ title: 'Recipes', tabBarIcon: tabIcon('recipes', 'recipesFilled') }}
      />
      <Tabs.Screen
        name="groceries"
        options={{ title: 'Groceries', tabBarIcon: tabIcon('basket', 'basketFilled') }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: tabIcon('sparkles', 'sparklesFilled') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('moreCircle', 'moreCircleFilled') }}
      />
    </Tabs>
  );
}
