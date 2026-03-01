import { api } from "./api";
import type { ApiResponse } from "../types/common";
import type { Customer, CustomerCreate } from "../types/customer";

const PREFIX = "/customers";

export interface CustomerListParams {
  search?: string;
  segment?: string;
  health_min?: number;
  health_max?: number;
  renewal_before?: string;
  renewal_within_days?: number;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface CustomerListResponse {
  data: Customer[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export async function listCustomers(
  params?: CustomerListParams
): Promise<CustomerListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.segment) searchParams.set("segment", params.segment);
  if (params?.health_min !== undefined) searchParams.set("health_min", String(params.health_min));
  if (params?.health_max !== undefined) searchParams.set("health_max", String(params.health_max));
  if (params?.renewal_before) searchParams.set("renewal_before", params.renewal_before);
  if (params?.renewal_within_days !== undefined) searchParams.set("renewal_within_days", String(params.renewal_within_days));
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.per_page) searchParams.set("per_page", String(params.per_page));
  if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params?.sort_order) searchParams.set("sort_order", params.sort_order);
  const qs = searchParams.toString();
  const url = qs ? `${PREFIX}?${qs}` : PREFIX;
  const { data } = await api.get<CustomerListResponse>(url);
  return data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data } = await api.get<ApiResponse<Customer>>(`${PREFIX}/${id}`);
  return data.data;
}

export interface CustomerStats {
  total_feedback: number;
  sentiment_breakdown: Record<string, number>;
  avg_sentiment_score: number;
  top_areas: string[];
  recent_trend: string;
  first_feedback_date: string | null;
  last_feedback_date: string | null;
}

export async function getCustomerStats(id: string): Promise<CustomerStats> {
  const { data } = await api.get<ApiResponse<CustomerStats>>(`${PREFIX}/${id}/stats`);
  return data.data;
}

export interface SentimentTrendPeriod {
  date: string | null;
  avg_sentiment: number;
  count: number;
}

export async function getCustomerSentimentTrend(id: string): Promise<SentimentTrendPeriod[]> {
  const { data } = await api.get<{ periods: SentimentTrendPeriod[] }>(`${PREFIX}/${id}/sentiment-trend`);
  return data.periods;
}

export interface CustomerFeedbackResponse {
  data: import("../types/feedback").Feedback[];
  pagination: { page: number; page_size: number; total: number };
}

export async function getCustomerFeedback(
  id: string,
  params?: { page?: number; page_size?: number }
): Promise<CustomerFeedbackResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("per_page", String(params.page_size));
  const qs = searchParams.toString();
  const url = qs ? `${PREFIX}/${id}/feedback?${qs}` : `${PREFIX}/${id}/feedback`;
  const { data } = await api.get<CustomerFeedbackResponse>(url);
  return data;
}

export async function createCustomer(body: CustomerCreate): Promise<Customer> {
  const { data } = await api.post<ApiResponse<Customer>>(PREFIX + "/", body);
  return data.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`${PREFIX}/${id}`);
}

export interface MergeDuplicatesResponse {
  merged_count: number;
  deleted_count: number;
}

export async function mergeDuplicateCustomers(): Promise<MergeDuplicatesResponse> {
  const { data } = await api.post<ApiResponse<MergeDuplicatesResponse>>(`${PREFIX}/merge-duplicates`);
  return data.data;
}
