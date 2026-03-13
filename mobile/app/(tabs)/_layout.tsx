import { Tabs } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import {
  LayoutDashboard,
  Target,
  Briefcase,
  Users,
  Mail,
  Settings,
} from 'lucide-react-native';
import { colors } from '../../constants/theme';

function TabBarIcon({
  icon: Icon,
  color,
  size,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  color: string;
  size: number;
}) {
  return <Icon size={size} color={color} strokeWidth={1.5} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: 'rgba(10,10,15,0.92)',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(10,10,15,0.92)',
                borderTopWidth: 1,
                borderTopColor: colors.border,
              },
            ]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={LayoutDashboard} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Target} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Briefcase} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Users} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketing"
        options={{
          title: 'Marketing',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Mail} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Settings} color={color} size={size} />
          ),
        }}
      />
      {/* Reports accessible from dashboard but not in tab bar */}
      <Tabs.Screen
        name="reports"
        options={{ href: null }}
      />
    </Tabs>
  );
}
