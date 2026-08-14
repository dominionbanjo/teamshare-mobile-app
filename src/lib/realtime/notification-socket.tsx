import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import * as React from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { queryKeys } from '@/lib/query/keys';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:4000';

/** Keeps one realtime notification socket alive for the session.
 *  Pushes `notification:new` rows and refreshes the notifications query. */
export function NotificationSocketBridge() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!token) return;
    const socket = io(`${WS_URL}/notifications`, { auth: { token } });
    socket.on('connect', () => socket.emit('join'));
    socket.on('notification:new', () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    });
    return () => {
      socket.disconnect();
    };
  }, [token, queryClient]);

  return null;
}
