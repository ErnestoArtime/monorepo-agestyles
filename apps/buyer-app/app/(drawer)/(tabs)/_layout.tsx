import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useCart } from '@/context/cart-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { cart } = useCart();

  const itemCount = cart?.items?.length || 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: Colors.light.border,
          height: 62,
          paddingTop: 7,
          paddingBottom: 7,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: Colors.light.text,
        headerShadowVisible: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'AgeStyles',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          headerShown: false, // Let the home stack manage its own headers
        }}
      />
      <Tabs.Screen
        name="(cart)"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors[colorScheme ?? 'light'].tint,
          },
          headerShown: false, // Let the cart stack manage its own headers
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <Ionicons size={25} name="person-outline" color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

