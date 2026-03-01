import { api } from "./api";
import type { ApiResponse } from "../types/common";

export interface Connector {
  id: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  channels?: string[];
  poll_interval_seconds?: number;
  last_sync_at: string | null;
  messages_processed: number;
  noise_filtered: number;
  last_error: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ConnectorHistoryItem {
  id: string;
  connector_id: string;
  event_type: string;
  messages_count: number;
  noise_filtered: number;
  channel_or_detail: string | null;
  created_at: string;
}

export async function listConnectors() {
  const { data } = await api.get<ApiResponse<Connector[]>>("/connectors");
  return data;
}

export async function connectSlack(body: {
  mode: "simulated" | "live";
  channels?: string[] | string;
  channel_ids?: string[];
  poll_interval_seconds?: number;
  slack_bot_token?: string;
  slack_team_id?: string;
}) {
  const { data } = await api.post<ApiResponse<Connector>>("/connectors/slack", body);
  return data;
}

export async function disconnectConnector(connectorId: string) {
  const { data } = await api.delete<ApiResponse<{ id: string; status: string }>>(
    `/connectors/${connectorId}`
  );
  return data;
}

export async function syncConnector(connectorId: string) {
  const { data } = await api.post<ApiResponse<Connector>>(
    `/connectors/${connectorId}/sync`
  );
  return data;
}

export async function getConnectorHistory(connectorId: string) {
  const { data } = await api.get<ApiResponse<ConnectorHistoryItem[]>>(
    `/connectors/${connectorId}/history`
  );
  return data;
}

export async function updateConnector(
  connectorId: string,
  body: { channels?: string[]; poll_interval_seconds?: number }
) {
  const { data } = await api.patch<ApiResponse<Connector>>(
    `/connectors/${connectorId}`,
    body
  );
  return data;
}
