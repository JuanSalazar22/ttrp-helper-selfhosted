import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Users, Dices, Settings, Bug } from 'lucide-react-native';
import { light, dark } from '@/tokens/colors';
import { useTranslation } from '@/i18n';
import { supabaseConfig } from '@/lib/config';

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
        name="report"
        options={{
          title: tr('tabs.report'),
          tabBarIcon: ({ color, size }) => <Bug size={size} color={color} />,
          // Hidden when Supabase is unconfigured — a report form with nowhere to send
          // is worse than no tab. Matches how AccountSheet hides account UI.
          href: supabaseConfig.enabled ? undefined : null,
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
