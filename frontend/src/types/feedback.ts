export const FEEDBACK_SOURCES = [
  "app_store_review",
  "support_ticket",
  "nps_survey",
  "slack",
  "email",
  "sales_call",
  "internal",
  "interview",
  "bug_report",
  "g2_review",
  "community",
  "other",
] as const;

export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

export interface Feedback {
  id: string;
  org_id: string;
  text: string;
  source?: string;
  author_name?: string;
  is_feedback: boolean;
  feedback_type?: string;
  sentiment?: string;
  sentiment_score?: number;
  product?: string;
  feature_area?: string;
  team?: string;
  urgency?: string;
  confidence?: number;
  rating?: number;
  customer_id?: string;
  customer_name?: string;
  customer_segment?: string;
  tags?: string;
  created_at?: string;
  ingested_at?: string;
  ingestion_method?: string;
  similarity_score?: number;
}

export interface FeedbackCreate {
  text: string;
  source?: string;
  author_name?: string;
  customer_id?: string;
  rating?: number;
  created_at?: string;
}
