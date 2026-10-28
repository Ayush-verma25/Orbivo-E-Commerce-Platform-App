import React, { createContext, useContext, useState, useEffect } from "react";
import { isAxiosError } from "axios";
import { authClient } from "../auth";
import { api } from "../config/api";

export interface User {
  id: number | string;
  name: string;
  email: string;
  role: "admin" | "merchant" | "customer" | string;
  store_id?: number | string | null;
}

export interface Store {
  id: number | string;
  merchant_id: string | number;
  name: string;
  slug: string;
  logo_url?: string;
  banner_url?: string;
  description?: string;
  currency: string;
  status: "active" | "suspended";
  shipping_fee: number;
  free_shipping_threshold: number;
  hero_style?: "hero1" | "hero2" | "hero3" | "hero4" | string;
  accent_color?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  store: Store | null;
  loading: boolean;
  login: (token: string, user: User, store?: Store | null) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
  setStore: (store: Store | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("Cartiva_token"),
  );
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMe = async () => {
    try {
      // Check active session directly via Neon Auth client
      const sessionRes = await authClient.getSession();
      if (sessionRes.error) throw sessionRes.error;
      const activeSession = sessionRes?.data?.session;
      const activeNeonUser = sessionRes?.data?.user;

      const savedToken =
        activeSession?.token || localStorage.getItem("Cartiva_token");

      if (!activeNeonUser) {
        localStorage.removeItem("Cartiva_token");
        setUser(null);
        setStore(null);
        setToken(null);
        setLoading(false);
        return;
      }

      // Persist the token BEFORE any authenticated API calls so the interceptor can use it
      if (savedToken) {
        localStorage.setItem("Cartiva_token", savedToken);
        setToken(savedToken);
      } else {
        // No token available — cannot make authenticated requests
        setUser({
          id: activeNeonUser.id,
          name: activeNeonUser.name || activeNeonUser.email.split("@")[0],
          email: activeNeonUser.email,
          role: "customer",
          store_id: null,
        });
        setStore(null);
        setLoading(false);
        return;
      }

      let initialRole: "admin" | "merchant" | "customer" | string = "customer";

      const neonRole = (activeNeonUser as any).role;
      if (neonRole === "admin") {
        initialRole = "admin";
      } else if (neonRole === "merchant") {
        initialRole = "merchant";
      }

      let resolvedStore: Store | null = null;
      let preserveStore = false;
      // Admin accounts cannot have stores or be merchants
      if (initialRole !== "admin") {
        try {
          const storeRes = await api.get("/api/stores/me");
          if (storeRes.data?.success && storeRes.data?.store) {
            resolvedStore = storeRes.data.store;
            initialRole = "merchant";
          }
        } catch (error) {
          preserveStore = !isAxiosError(error) || error.response?.status !== 404;
        }
      }

      setUser((previousUser) => ({
        id: activeNeonUser.id,
        name: activeNeonUser.name || activeNeonUser.email.split("@")[0],
        email: activeNeonUser.email,
        role: preserveStore ? previousUser?.role || initialRole : initialRole,
        store_id: preserveStore
          ? previousUser?.store_id ?? null
          : initialRole === "admin" ? null : resolvedStore?.id || null,
      }));

      if (!preserveStore) {
        setStore(initialRole === "admin" ? null : resolvedStore);
      }
    } catch (err) {
      console.error("Error refreshing auth session", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = (newToken: string, newUser: User, newStore?: Store | null) => {
    if (newToken) {
      localStorage.setItem("Cartiva_token", newToken);
      setToken(newToken);
    }
    setUser(newUser);
    if (newStore !== undefined) {
      setStore(newStore);
    }
  };

  const logout = async () => {
    try {
      await authClient.signOut();
    } catch (e) {
      console.warn("SignOut error", e);
    }
    localStorage.removeItem("Cartiva_token");
    setToken(null);
    setUser(null);
    setStore(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        store,
        loading,
        login,
        logout,
        refreshMe,
        setStore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
