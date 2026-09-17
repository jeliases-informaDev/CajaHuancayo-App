import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import { ApiError, request } from "./api";
import { getDeviceId } from "./deviceIdentity";

type User = { id: string; username: string; rol: "SUPERVISOR" | "AUDITOR" | "ADMINISTRADOR"; nombres?: string; apellidos?: string };
type AuthValue = {
  token: string | null; user: User | null; loading: boolean; offlineSession: boolean;
  login: (username: string, password: string) => Promise<any>;
  verifyMfa: (challengeToken: string, code: string, enroll?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
};
type OfflineSession = { user: User; verifiedAt: number; expiresAt: number };

const Context = createContext<AuthValue | null>(null);
const TOKEN_KEY = "ch_token";
const OFFLINE_SESSION_KEY = "ch_offline_session_v1";
const OFFLINE_SESSION_MS = 8 * 60 * 60 * 1000;
const FIELD_ROLES = ["SUPERVISOR", "AUDITOR"];
const NATIVE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const secureStore = {
  get: async (key: string) => Platform.OS === "web"
    ? globalThis.localStorage?.getItem(key) || null
    : SecureStore.getItemAsync(key, NATIVE_STORE_OPTIONS),
  set: async (key: string, value: string) => {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value, NATIVE_STORE_OPTIONS);
  },
  remove: async (key: string) => {
    if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key, NATIVE_STORE_OPTIONS);
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineSession, setOfflineSession] = useState(false);

  const ensureFieldUser = (account: any) => {
    if (!FIELD_ROLES.includes(account?.rol)) {
      throw new Error("Esta aplicación es exclusiva para supervisores y auditores. Usa el backoffice para funciones administrativas.");
    }
  };

  const persistValidatedSession = async (accessToken: string, account: User) => {
    const now = Date.now();
    const snapshot: OfflineSession = { user: account, verifiedAt: now, expiresAt: now + OFFLINE_SESSION_MS };
    await Promise.all([
      secureStore.set(TOKEN_KEY, accessToken),
      secureStore.set(OFFLINE_SESSION_KEY, JSON.stringify(snapshot)),
    ]);
  };

  const clearSession = async () => {
    setToken(null); setUser(null); setOfflineSession(false);
    await Promise.all([secureStore.remove(TOKEN_KEY), secureStore.remove(OFFLINE_SESSION_KEY)]);
  };

  const complete = async (data: any) => {
    ensureFieldUser(data.user);
    await persistValidatedSession(data.token, data.user);
    setToken(data.token); setUser(data.user); setOfflineSession(false);
  };

  const restoreOfflineSession = async (savedToken: string) => {
    const raw = await secureStore.get(OFFLINE_SESSION_KEY);
    const cached = raw ? (JSON.parse(raw) as OfflineSession) : null;
    if (!cached || cached.expiresAt <= Date.now()) return false;
    ensureFieldUser(cached.user);
    setToken(savedToken); setUser(cached.user); setOfflineSession(true);
    return true;
  };

  useEffect(() => {
    (async () => {
      await getDeviceId();
      const savedToken = await secureStore.get(TOKEN_KEY);
      if (!savedToken) { setLoading(false); return; }
      try {
        const network = await NetInfo.fetch();
        if (network.isConnected === false || network.isInternetReachable === false) {
          if (!(await restoreOfflineSession(savedToken))) await clearSession();
          return;
        }
        const data: any = await request("/api/auth/me", {}, savedToken);
        ensureFieldUser(data.user);
        await persistValidatedSession(savedToken, data.user);
        setToken(savedToken); setUser(data.user); setOfflineSession(false);
      } catch (error) {
        // Solo un fallo real de conectividad permite recuperar temporalmente
        // la sesión cifrada. Una respuesta HTTP inválida elimina el acceso.
        if (error instanceof ApiError) await clearSession();
        else {
          try {
            if (!(await restoreOfflineSession(savedToken))) await clearSession();
          } catch { await clearSession(); }
        }
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!offlineSession || !token) return;
    return NetInfo.addEventListener((network) => {
      const connected = Boolean(network.isConnected && network.isInternetReachable !== false);
      if (!connected) return;
      request<any>("/api/auth/me", {}, token)
        .then(async (data) => {
          ensureFieldUser(data.user);
          await persistValidatedSession(token, data.user);
          setUser(data.user); setOfflineSession(false);
        })
        .catch(async (error) => { if (error instanceof ApiError) await clearSession(); });
    });
  }, [offlineSession, token]);

  const value = useMemo<AuthValue>(() => ({
    token, user, loading, offlineSession,
    login: async (username, password) => {
      const deviceId = await getDeviceId();
      const data: any = await request("/api/auth/login", {
        method: "POST", body: JSON.stringify({ username, password }), headers: { "x-device-id": deviceId },
      });
      if (!data.mfaRequired && !data.mfaEnrollmentRequired) await complete(data);
      return data;
    },
    verifyMfa: async (challengeToken, code, enroll = false) => {
      const data: any = await request(
        enroll ? "/api/auth/mfa/enroll/confirm" : "/api/auth/mfa/verify",
        { method: "POST", body: JSON.stringify({ challengeToken, code }) },
      );
      await complete(data);
    },
    logout: async () => {
      try { if (token) await request("/api/auth/logout", { method: "POST" }, token); } catch {}
      await clearSession();
    },
    api: <T,>(path: string, options: RequestInit = {}) => request<T>(path, options, token),
  }), [token, user, loading, offlineSession]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useAuth = () => {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider requerido");
  return context;
};
