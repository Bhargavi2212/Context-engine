import { api } from "./api";
import type { ApiResponse } from "../types/common";

const PREFIX = "/agent";

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  data: {
    response: string;
    intent: string;
    conversation_id: string;
  };
}

export async function postChat(
  message: string,
  conversationId?: string
): Promise<ChatResponse["data"]> {
  const { data } = await api.post<ChatResponse>(`${PREFIX}/chat`, {
    message,
    conversation_id: conversationId,
  });
  return data.data;
}

export interface ConversationListItem {
  id: string;
  title: string;
  created_at: string;
}

export interface ConversationsListResponse {
  data: ConversationListItem[];
}

export async function getConversations(): Promise<ConversationListItem[]> {
  const { data } = await api.get<ConversationsListResponse>(`${PREFIX}/conversations`);
  return data.data;
}

export interface Message {
  role: string;
  content: string;
  timestamp?: string;
  intent?: string;
}

export interface Conversation {
  id: string;
  org_id: string;
  user_id: string;
  messages: Message[];
  title?: string;
}

export interface ConversationResponse {
  data: Conversation;
}

export async function getConversation(id: string): Promise<Conversation> {
  const { data } = await api.get<ConversationResponse>(`${PREFIX}/conversations/${id}`);
  return data.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await api.delete(`${PREFIX}/conversations/${id}`);
}
