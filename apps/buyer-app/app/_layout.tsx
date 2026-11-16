import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { CartProvider } from '@/context/cart-context';
import { CustomerProvider } from '@/context/customer-context';
import { RegionProvider } from '@/context/region-context';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <RegionProvider>
          <CartProvider>
            <CustomerProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
              <Stack.Screen
                name="checkout"
                options={{
                  headerShown: true,
                  title: 'Checkout',
                  presentation: 'card',
                  headerBackButtonDisplayMode: "minimal",
                }}
              />
              <Stack.Screen
                name="order-confirmation/[id]"
                options={{
                  headerShown: true,
                  title: 'Order Confirmed',
                  headerLeft: () => null,
                  gestureEnabled: false,
                  headerBackVisible: false,
                }}
              />
            </Stack>
            <StatusBar style="dark" />
            </CustomerProvider>
          </CartProvider>
        </RegionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
