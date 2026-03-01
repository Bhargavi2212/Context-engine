export interface UploadParse {
  upload_id: string;
  filename: string;
  rows: number;
  columns: string[];
  preview: Record<string, string>[];
  suggested_mapping: Record<string, string>;
}

export interface ImportFeedbackRequest {
  upload_id: string;
  column_mapping: Record<string, string>;
  default_source?: string;
  use_today_for_date?: boolean;
}

export interface ImportFeedbackResponse {
  total: number;
  feedback_count: number;
  noise_count: number;
  sentiment_breakdown: Record<string, number>;
  top_areas: { area: string; count: number }[];
  customers_linked: number;
  customers_unlinked: number;
  processing_time_seconds: number;
}

export interface ImportCustomerResponse {
  count: number;
  segments: Record<string, number>;
  total_arr: number;
}

export interface UploadStatus {
  processed: number;
  total: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  imported_rows?: number;
  failed_rows?: number;
  result_data?: {
    sentiment_breakdown?: Record<string, number>;
    top_areas?: { area: string; count: number }[];
    segments?: Record<string, number>;
    total_arr?: number;
  };
}

export interface UploadHistoryItem {
  id: string;
  org_id: string;
  upload_id: string;
  upload_type: string;
  filename: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  status: string;
  processed: number;
  created_at?: string;
}
