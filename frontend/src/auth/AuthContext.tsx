import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';
import type { Me } from '../lib/types';

interface AuthResponse {
  accessToken: string;
  user: Me;
}

interface AuthState {
  user: Me | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(!!token);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return;
    const me = await api.get<Me>('/users/me');
    setUser(me);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<Me>('/users/me')
      .then((me) => !cancelled && setUser(me))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const accept = useCallback((res: AuthResponse) => {
    tokenStore.set(res.accessToken);
    setUser(res.user);
    setToken(res.accessToken);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      logout,
      refresh,
      login: async (email, password) => accept(await api.post<AuthResponse>('/auth/login', { email, password })),
      register: async (email, username, password) =>
        accept(await api.post<AuthResponse>('/auth/register', { email, username, password })),
      loginWithGoogle: async (idToken) => accept(await api.post<AuthResponse>('/auth/google', { idToken })),
    }),
    [user, token, loading, logout, refresh, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}

export function useMe() {
  const { user } = useAuth();
  if (!user) throw new Error('useMe requiere sesión iniciada');
  return user;
}
