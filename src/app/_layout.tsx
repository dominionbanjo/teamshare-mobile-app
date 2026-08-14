import '@/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { PortalHost } from '@rn-primitives/portal';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthGate, AuthProvider } from '@/lib/auth/auth-context';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate />
          <Stack
            screenOptions={{
              headerTintColor: colorScheme === 'dark' ? DefaultTheme.colors.text : '#fff',
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#4F46E5' },
              headerTitleStyle: { color: '#fff', fontWeight: '600' },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-intro" options={{ headerShown: false }} />
            <Stack.Screen name="projects/[id]" options={{ title: 'Project' }} />
            <Stack.Screen name="tasks/[id]" options={{ title: 'Task' }} />
            <Stack.Screen name="companies/index" options={{ title: 'Companies' }} />
            <Stack.Screen name="companies/[id]" options={{ title: 'Company' }} />
            <Stack.Screen name="teams" options={{ title: 'Teams' }} />
            <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
            <Stack.Screen name="billing" options={{ title: 'Billing' }} />
          </Stack>
          <PortalHost />
          <AnimatedSplashOverlay />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
