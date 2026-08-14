import { apiFetch, apiFetchEnvelope } from './client';
import type { ChatMessage, Paginated } from './types';

export interface SendChatMessagePayload {
  projectId: string;
  body: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
}

/** Chat history for a project channel. Live traffic flows over socket.io. */
export async function listChatMessages(
  token: string,
  projectId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<ChatMessage>> {
  return apiFetchEnvelope<ChatMessage[]>('/chat/messages', { token, query: { projectId, page, pageSize } }).then(
    ({ data, pagination }) => ({
      items: data,
      pagination: pagination ?? { page, pageSize, total: data.length, totalPages: 1 },
    })
  );
}

export async function sendChatMessage(token: string, payload: SendChatMessagePayload): Promise<ChatMessage> {
  return apiFetch<ChatMessage>('/chat/messages', { method: 'POST', body: payload, token });
}
