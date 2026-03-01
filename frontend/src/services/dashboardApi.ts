import { api } from "./api";
import type { ApiResponse } from "../types/common";

const PREFIX = "/dashboard";

/** Summary widget: totals and averages */
export interface DashboardSummary {
  total_feedback: number;
  total_noise: number;
  avg_sentiment: number | null;
  active_customers: number;
  open_issues: number;
  specs_generated: number;
}

/** One bucket for volume-over-time chart */
export interface VolumeOverTimeItem {
  date: string;
  count: number;
  sentiment: number;
}

/** Sentiment counts */
export interface SentimentBreakdown {
  positive: number;
  negative: number;
  neutral: number;
}

/** One RICE-scored issue */
export interface TopIssueRice {
  feature_area: string;
  rice_score: number;
  feedback_count: number;
  unique_customers: number;
  arr_at_risk: number;
  avg_sentiment: number;
  trend: "worsening" | "improving" | "stable" | "new";
  team: string | null;
  related_goal: string | null;
}

/** One at-risk customer row */
export interface AtRiskCustomer {
  id: string;
  company_name: string;
  arr: number;
  health_score: number | null;
  renewal_date: string | null;
  days_to_renewal: number | null;
  recent_sentiment: number | null;
  feedback_count: number;
  top_complaint: string | null;
}

/** One recent feedback row */
export interface RecentFeedbackItem {
  id: string;
  text: string;
  sentiment: string;
  feature_area: string | null;
  customer_name: string | null;
  created_at: string;
}

/** Source → count */
export type SourceDistribution = Record<string, number>;

/** Area → count + sentiment */
export type AreaBreakdown = Record<string, { count: number; sentiment: number }>;

/** Segment → count, sentiment, arr */
export type SegmentBreakdown = Record<
  string,
  { count: number; sentiment: number; arr: number }
>;

/** Full dashboard payload (all 9 sections) */
export interface DashboardData {
  summary: DashboardSummary;
  volume_over_time: VolumeOverTimeItem[];
  sentiment_breakdown: SentimentBreakdown;
  top_issues_rice: TopIssueRice[];
  at_risk_customers: AtRiskCustomer[];
  recent_feedback: RecentFeedbackItem[];
  source_distribution: SourceDistribution;
  area_breakdown: AreaBreakdown;
  segment_breakdown: SegmentBreakdown;
}

export interface DashboardParams {
  period?: string; // "7d" | "30d" | "90d" | "custom"
  date_from?: string; // YYYY-MM-DD when period=custom
  date_to?: string;
}

export async function getDashboardData(params?: DashboardParams): Promise<DashboardData> {
  const searchParams = new URLSearchParams();
  if (params?.period) searchParams.set("period", params.period);
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  const qs = searchParams.toString();
  const url = qs ? `${PREFIX}?${qs}` : PREFIX;
  const { data } = await api.get<ApiResponse<DashboardData>>(url);
  return data.data;
}
