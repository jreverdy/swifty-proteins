import React, { createContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

type AuthContextType = {
  user: string | null;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {},
  logout: async () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const storedUser = await SecureStore.getItemAsync("CURRENT_USER");
    setUser(storedUser);
    setLoading(false);
  }

  async function login(username: string) {
    await SecureStore.setItemAsync("CURRENT_USER", username);
    setUser(username);
  }

  async function logout() {
    await SecureStore.deleteItemAsync("CURRENT_USER");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
