import { api } from "./api";

const PREFIX = "/monitoring";

export interface AgentStats {
  total_calls: number;
  avg_latency_ms: number | null;
  tool_counts: Record<string, number>;
  most_used_tool: string;
  model_usage: Record<string, number>;
  recent_activity: Array<{
    agent_type: string;
    tool_used: string;
    latency_ms: number;
    model: string;
    created_at: string;
  }>;
}

export async function getAgentStats(): Promise<AgentStats> {
  const { data } = await api.get<{ data: AgentStats }>(`${PREFIX}/agent-stats`);
  return data.data;
}
