export const CUSTOMER_SEGMENTS = [
  "enterprise",
  "smb",
  "trial",
  "consumer",
] as const;

export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export interface Customer {
  id: string;
  org_id: string;
  company_name: string;
  segment?: string;
  plan?: string;
  mrr?: number;
  arr?: number;
  account_manager?: string;
  renewal_date?: string;
  health_score?: number;
  industry?: string;
  employee_count?: number;
  created_at?: string;
  feedback_count?: number;
  avg_sentiment?: number;
}

export interface CustomerCreate {
  company_name: string;
  segment?: string;
  plan?: string;
  mrr?: number;
  arr?: number;
  account_manager?: string;
  renewal_date?: string;
  health_score?: number;
  industry?: string;
  employee_count?: number;
}
