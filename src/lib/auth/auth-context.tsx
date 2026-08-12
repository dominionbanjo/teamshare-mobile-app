import * as React from 'react';
import { useRouter } from 'expo-router';

import * as authApi from '@/lib/api/auth';
import { clearSession, loadSession, saveSession, updateSessionUser } from '@/lib/api/session';
import type { AuthResponse, User } from '@/lib/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [user, setUser] = React.useState<User | null>(null);
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await loadSession();
      if (cancelled) return;
      if (session?.tokens.accessToken && session.user) {
        setToken(session.tokens.accessToken);
        setUser(session.user);
        setStatus('authenticated');
        authApi
          .getMe(session.tokens.accessToken)
          .then(async (fresh) => {
            if (cancelled) return;
            setUser(fresh);
            await updateSessionUser(fresh);
          })
          .catch(async () => {
            if (cancelled) return;
            await clearSession();
            setUser(null);
            setToken(null);
            setStatus('unauthenticated');
          });
      } else {
        setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAuth = React.useCallback(async (response: AuthResponse) => {
    const session = { user: response.user, tokens: response.tokens };
    await saveSession(session);
    setUser(response.user);
    setToken(response.tokens.accessToken);
    setStatus('authenticated');
  }, []);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login({ email, password });
      await applyAuth(response);
    },
    [applyAuth]
  );

  const register = React.useCallback(
    async (name: string, email: string, password: string) => {
      const response = await authApi.register({ name, email, password });
      await applyAuth(response);
    },
    [applyAuth]
  );

  const logout = React.useCallback(async () => {
    await clearSession();
    setUser(null);
    setToken(null);
    setStatus('unauthenticated');
  }, []);

  const refreshUser = React.useCallback(async () => {
    if (!token) return;
    const fresh = await authApi.getMe(token);
    setUser(fresh);
    await updateSessionUser(fresh);
  }, [token]);

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, token, login, register, logout, refreshUser }),
    [status, user, token, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/** Redirects between (tabs) and (auth) groups based on session state. */
export function AuthGate() {
  const { status } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else {
      router.replace('/');
    }
  }, [status, router]);

  return null;
}
