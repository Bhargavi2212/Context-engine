export interface SpecListItem {
  id: string;
  topic: string;
  status: "draft" | "final" | "shared";
  arr_impacted: number;
  rice_score: number;
  feedback_count: number;
  created_at: string;
}

export interface SpecDetail extends SpecListItem {
  prd: string;
  architecture: string;
  rules: string;
  plan: string;
  feedback_ids: string[];
  customer_ids: string[];
}
