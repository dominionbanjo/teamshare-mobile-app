import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthTokens, User } from './types';

export interface SessionData {
  user: User;
  tokens: AuthTokens;
}

const SESSION_KEY = 'teamshare.session';

export async function saveSession(session: SessionData): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function updateSessionUser(user: User): Promise<void> {
  const session = await loadSession();
  if (session) await saveSession({ ...session, user });
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
