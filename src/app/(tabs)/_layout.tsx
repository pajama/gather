import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon, useTheme } from '@/ui';

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8, paddingTop: 6 } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Recipes', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'bookFilled' : 'book'} color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'compassFilled' : 'compass'} color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: 'Plan', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'calendarFilled' : 'calendar'} color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="groceries"
        options={{ title: 'Groceries', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'cartFilled' : 'cart'} color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'settingsFilled' : 'settings'} color={color} size={24} /> }}
      />
    </Tabs>
  );
}
