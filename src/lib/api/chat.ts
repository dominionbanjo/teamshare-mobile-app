import { apiFetch, apiFetchEnvelope } from './client';
import type { ChatChannel, ChatMessage, Paginated } from './types';

export interface SendChatMessagePayload {
  projectId: string;
  channelId?: string;
  body: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMime?: string;
}

export interface ChannelListEntry extends ChatChannel {
  messageCount: number;
  lastMessageAt: string | null;
}

/** Chat history for a project channel. Live traffic flows over socket.io. */
export async function listChatMessages(
  token: string,
  projectId: string,
  channelId: string,
  page = 1,
  pageSize = 100
): Promise<Paginated<ChatMessage>> {
  return apiFetchEnvelope<ChatMessage[]>('/chat/messages', {
    token,
    query: { projectId, channelId, page, pageSize },
  }).then(({ data, pagination }) => ({
    items: data,
    pagination: pagination ?? { page, pageSize, total: data.length, totalPages: 1 },
  }));
}

export async function sendChatMessage(token: string, payload: SendChatMessagePayload): Promise<ChatMessage> {
  return apiFetch<ChatMessage>('/chat/messages', { method: 'POST', body: payload, token });
}

/** Edit an own message (10-minute window). */
export async function editChatMessage(token: string, messageId: string, body: string): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/messages/${messageId}`, { method: 'PATCH', body: { body }, token });
}

/** Delete a message (author or project owner). */
export async function deleteChatMessage(
  token: string,
  messageId: string
): Promise<{ id: string; deleted: boolean }> {
  return apiFetch<{ id: string; deleted: boolean }>(`/chat/messages/${messageId}`, {
    method: 'DELETE',
    token,
  });
}

/* ---------------------------------------------------------- channels */

export async function listChatChannels(token: string, projectId: string): Promise<ChannelListEntry[]> {
  const { data } = await apiFetchEnvelope<ChannelListEntry[]>('/chat/channels', {
    token,
    query: { projectId },
  });
  return data;
}

export async function createChatChannel(
  token: string,
  payload: { projectId: string; name: string; description?: string }
): Promise<ChatChannel> {
  return apiFetch<ChatChannel>('/chat/channels', { method: 'POST', body: payload, token });
}

export async function updateChatChannel(
  token: string,
  channelId: string,
  payload: { name?: string; description?: string | null }
): Promise<ChatChannel> {
  return apiFetch<ChatChannel>(`/chat/channels/${channelId}`, { method: 'PATCH', body: payload, token });
}

export async function deleteChatChannel(
  token: string,
  channelId: string
): Promise<{ id: string; deleted: boolean }> {
  return apiFetch<{ id: string; deleted: boolean }>(`/chat/channels/${channelId}`, {
    method: 'DELETE',
    token,
  });
}
