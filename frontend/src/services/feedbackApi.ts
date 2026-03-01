import { api } from "./api";
import type { ApiResponse } from "../types/common";
import type { Feedback, FeedbackCreate } from "../types/feedback";

const PREFIX = "/feedback";

export interface FeedbackListParams {
  search?: string;
  product_area?: string;
  sentiment?: string;
  source?: string;
  customer_segment?: string;
  customer_id?: string;
  is_feedback?: boolean;
  urgency?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface FeedbackListResponse {
  data: Feedback[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export async function listFeedback(
  params?: FeedbackListParams
): Promise<FeedbackListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.product_area) searchParams.set("product_area", params.product_area);
  if (params?.sentiment) searchParams.set("sentiment", params.sentiment);
  if (params?.source) searchParams.set("source", params.source);
  if (params?.customer_segment) searchParams.set("customer_segment", params.customer_segment);
  if (params?.customer_id) searchParams.set("customer_id", params.customer_id);
  if (params?.is_feedback !== undefined) searchParams.set("is_feedback", String(params.is_feedback));
  if (params?.urgency) searchParams.set("urgency", params.urgency);
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.per_page) searchParams.set("per_page", String(params.per_page));
  const qs = searchParams.toString();
  const url = qs ? `${PREFIX}?${qs}` : PREFIX;
  const { data } = await api.get<FeedbackListResponse>(url);
  return data;
}

export interface SearchFeedbackParams {
  q: string;
  product_area?: string;
  sentiment?: string;
  source?: string;
  customer_segment?: string;
  urgency?: string;
  feedback_type?: string;
  is_feedback?: boolean;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface SearchFeedbackResponse {
  data: Feedback[];
  total: number;
  query: string;
}

export async function searchFeedback(params: SearchFeedbackParams): Promise<SearchFeedbackResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  if (params.product_area) searchParams.set("product_area", params.product_area);
  if (params.sentiment) searchParams.set("sentiment", params.sentiment);
  if (params.source) searchParams.set("source", params.source);
  if (params.customer_segment) searchParams.set("customer_segment", params.customer_segment);
  if (params.urgency) searchParams.set("urgency", params.urgency);
  if (params.feedback_type) searchParams.set("feedback_type", params.feedback_type);
  if (params.is_feedback !== undefined) searchParams.set("is_feedback", String(params.is_feedback));
  if (params.date_from) searchParams.set("date_from", params.date_from);
  if (params.date_to) searchParams.set("date_to", params.date_to);
  if (params.limit) searchParams.set("limit", String(params.limit));
  const { data } = await api.get<SearchFeedbackResponse>(`${PREFIX}/search?${searchParams.toString()}`);
  return data;
}

export interface FeedbackStats {
  total: number;
  feedback_count: number;
  noise_count: number;
  by_sentiment: Record<string, number>;
  by_feature_area: Record<string, number>;
  by_source: Record<string, number>;
  by_urgency: Record<string, number>;
  by_segment: Record<string, number>;
  by_feedback_type: Record<string, number>;
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
  const { data } = await api.get<ApiResponse<FeedbackStats>>(`${PREFIX}/stats`);
  return data.data;
}

export async function getSimilarFeedback(id: string, limit = 5): Promise<Feedback[]> {
  const { data } = await api.get<ApiResponse<Feedback[]>>(`${PREFIX}/${id}/similar?limit=${limit}`);
  return data.data;
}

export async function getFeedback(id: string): Promise<Feedback> {
  const { data } = await api.get<ApiResponse<Feedback>>(`${PREFIX}/${id}`);
  return data.data;
}

export async function createFeedback(body: FeedbackCreate): Promise<Feedback> {
  const { data } = await api.post<ApiResponse<Feedback>>(PREFIX + "/", body);
  return data.data;
}

export async function deleteFeedback(id: string): Promise<void> {
  await api.delete(`${PREFIX}/${id}`);
}

export interface MergeDuplicatesResponse {
  merged_count: number;
  deleted_count: number;
}

export async function mergeDuplicateFeedback(): Promise<MergeDuplicatesResponse> {
  const { data } = await api.post<ApiResponse<MergeDuplicatesResponse>>(
    `${PREFIX}/merge-duplicates`
  );
  return data.data;
}
