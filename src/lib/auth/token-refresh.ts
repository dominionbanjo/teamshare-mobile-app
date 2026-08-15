/**
 * Access-token lifecycle for the mobile app (IMP-250).
 *
 * The backend rotates access tokens every 15 minutes. The API client
 * (client.ts) intercepts 401s, exchanges the stored refresh token for a
 * fresh pair via POST /auth/refresh, retries the original request once, and
 * notifies subscribers (auth-context + socket bridge) of the new token.
 *
 * This module deliberately avoids importing apiFetch (no circular deps) -
 * it does its own fetch against the envelope contract.
 */
import { API_BASE_URL } from '@/lib/api/client';
import { loadSession, saveSession } from '@/lib/api/session';

type RefreshResponse = {
  success: true;
  data: { user: unknown; accessToken: string; refreshToken: string };
};

let accessToken: string | null = null;
let refreshTokenValue: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
const listeners = new Set<(token: string) => void>();

/** Records the current token pair (call on session load / login / refresh). */
export function setTokenPair(access: string, refresh: string): void {
  accessToken = access;
  refreshTokenValue = refresh;
}

export function clearTokenPair(): void {
  accessToken = null;
  refreshTokenValue = null;
  refreshPromise = null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Subscribe to token refreshes (auth-context state, socket re-auth). */
export function onTokenRefreshed(cb: (token: string) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Exchanges the refresh token for a new access/refresh pair (rotated),
 * persists the session and notifies listeners. Concurrent callers share one
 * in-flight refresh. Returns the fresh access token, or null on failure.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshTokenValue) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      });
      const payload = (await response.json()) as RefreshResponse;
      if (!response.ok || !payload.success) return null;

      const { accessToken: nextAccess, refreshToken: nextRefresh } = payload.data;
      accessToken = nextAccess;
      refreshTokenValue = nextRefresh;
      const session = await loadSession();
      if (session) {
        await saveSession({
          user: payload.data.user as typeof session.user,
          tokens: { accessToken: nextAccess, refreshToken: nextRefresh },
        });
      }
      listeners.forEach((cb) => cb(nextAccess));
      return nextAccess;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
