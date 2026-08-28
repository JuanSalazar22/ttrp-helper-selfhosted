import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Users, Dices, Settings } from 'lucide-react-native';
import { light, dark } from '@/tokens/colors';
import { useTranslation } from '@/i18n';

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  const tr = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tr('tabs.characters'),
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dice"
        options={{
          title: tr('tabs.dice'),
          tabBarIcon: ({ color, size }) => (
            <Dices size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: tr('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
