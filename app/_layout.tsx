import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ParkingProvider } from '@/context/ParkingContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { DialogProvider } from '@/context/DialogContext';
import { getOnboardingState } from '@/services/onboarding';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    const loadOnboardingState = async () => {
      const state = await getOnboardingState();
      setIsOnboardingComplete(state.completed);
      setIsOnboardingReady(true);
    };

    void loadOnboardingState();
  }, []);

  useEffect(() => {
    if (!isOnboardingReady) return;

    const syncOnboardingRoute = async () => {
      const latestState = await getOnboardingState();
      const completed = latestState.completed;

      if (completed !== isOnboardingComplete) {
        setIsOnboardingComplete(completed);
      }

      const inOnboarding = segments[0] === 'onboarding';

      if (!completed && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }

      if (completed && inOnboarding) {
        router.replace('/(tabs)');
      }
    };

    void syncOnboardingRoute();
  }, [isOnboardingComplete, isOnboardingReady, router, segments]);

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="history/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="settings/gamification" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DialogProvider>
          <ParkingProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </ParkingProvider>
        </DialogProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
