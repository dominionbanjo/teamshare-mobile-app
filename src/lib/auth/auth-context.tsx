import * as React from 'react';
import { usePathname, useRouter } from 'expo-router';

import * as authApi from '@/lib/api/auth';
import { clearSession, loadSession, saveSession, updateSessionUser } from '@/lib/api/session';
import {
  clearTokenPair,
  onTokenRefreshed,
  setTokenPair,
} from '@/lib/auth/token-refresh';
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
  /** Exchange a Google OAuth code for a session (same flow as login). */
  completeGoogle: (code: string) => Promise<void>;
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
        // Mirror the session into the token-refresh module so the API client
        // can rotate the access token on 401 (IMP-250).
        setTokenPair(session.tokens.accessToken, session.tokens.refreshToken);
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
            clearTokenPair();
            setUser(null);
            setToken(null);
            setStatus('unauthenticated');
          });
      } else {
        setStatus('unauthenticated');
      }
    })();
    // Keep React state in sync when the API client rotates the access token.
    const unsubscribe = onTokenRefreshed((next) => setToken(next));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const applyAuth = React.useCallback(async (response: AuthResponse) => {
    const session = { user: response.user, tokens: response.tokens };
    await saveSession(session);
    setTokenPair(response.tokens.accessToken, response.tokens.refreshToken);
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
    clearTokenPair();
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

  const completeGoogle = React.useCallback(
    async (code: string) => {
      const response = await authApi.googleToken(code);
      await applyAuth(response);
    },
    [applyAuth]
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({ status, user, token, login, register, logout, refreshUser, completeGoogle }),
    [status, user, token, login, register, logout, refreshUser, completeGoogle]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

/** Redirects between (tabs), workspace-intro and (auth) groups based on session state. */
export function AuthGate() {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      if (pathname !== '/login' && pathname !== '/register') {
        router.replace('/login');
      }
    } else if (pathname !== '/workspace-intro') {
      router.replace('/');
    }
  }, [status, router, pathname]);

  return null;
}
