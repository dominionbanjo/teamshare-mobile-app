import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { googleAuthorize } from '@/lib/api/auth';

export const GOOGLE_REDIRECT_URL = 'teamsharemobileapp://login';

export type GoogleSignInResult = { code: string } | 'cancelled';

/**
 * Runs the Google OAuth flow in an in-app browser session:
 * authorize -> user approves -> redirect back with ?code= (or ?error=).
 * Returns the code for completeGoogle(), or 'cancelled' when the user
 * dismisses the browser.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  WebBrowser.maybeCompleteAuthSession();
  const { url } = await googleAuthorize();
  const result = await WebBrowser.openAuthSessionAsync(url, GOOGLE_REDIRECT_URL);
  if (result.type !== 'success') return 'cancelled';

  const params = Linking.parse(result.url).queryParams ?? {};
  const code = typeof params.code === 'string' ? params.code : undefined;
  const error = typeof params.error === 'string' ? params.error : undefined;
  if (error) throw new Error(error);
  if (!code) throw new Error('Google sign-in did not return a code.');
  return { code };
}
