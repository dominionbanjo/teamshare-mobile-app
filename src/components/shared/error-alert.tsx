import { Alert } from 'react-native';
import { normalizeError, errorAlertTitle, isRateLimitError } from '@/lib/api/client';

/**
 * Show an error alert with normalized message.
 * Auto-detects rate limits, network errors, and API errors.
 *
 * Usage: `errorAlert(err, 'Could not save task')`
 */
export function errorAlert(err: unknown, contextLabel: string): void {
  const title = errorAlertTitle(err, contextLabel);
  const message = normalizeError(err);
  Alert.alert(title, message);
}

/**
 * Show a rate limit specific alert with retry hint.
 */
export function rateLimitAlert(err: unknown): void {
  Alert.alert('Rate limit reached', normalizeError(err));
}
