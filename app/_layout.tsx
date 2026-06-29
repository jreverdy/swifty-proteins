import { Stack, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

export default function RootLayout() {
  const router = useRouter();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasInBackground = appState.current.match(/inactive|background/);

      if (wasInBackground && nextAppState === "active") {
        router.replace("/login");
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="home" />
      <Stack.Screen name="protein" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
