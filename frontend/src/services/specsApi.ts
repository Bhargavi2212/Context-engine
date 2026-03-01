import { api } from "./api";
import type { SpecListItem, SpecDetail } from "../types/specs";

const PREFIX = "/specs";

export interface ListSpecsParams {
  page?: number;
  page_size?: number;
  status?: string;
}

export interface ListSpecsResponse {
  data: SpecListItem[];
  total: number;
}

export async function listSpecs(params?: ListSpecsParams): Promise<ListSpecsResponse> {
  const { data } = await api.get<ListSpecsResponse>(PREFIX, { params });
  return data ?? { data: [], total: 0 };
}

export async function getSpec(id: string): Promise<SpecDetail> {
  const { data } = await api.get<{ data: SpecDetail }>(`${PREFIX}/${id}`);
  return data.data;
}

export async function updateSpecStatus(
  id: string,
  status: "draft" | "final" | "shared"
): Promise<SpecDetail> {
  const { data } = await api.put<{ data: SpecDetail }>(`${PREFIX}/${id}/status`, { status });
  return data.data;
}

export async function deleteSpec(id: string): Promise<void> {
  await api.delete(`${PREFIX}/${id}`);
}

export async function regenerateSpec(id: string): Promise<SpecDetail> {
  const { data } = await api.post<{ data: SpecDetail }>(`${PREFIX}/${id}/regenerate`);
  return data.data;
}
