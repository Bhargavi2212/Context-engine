/** Product wizard section names (8 steps; Steps 4 and 6 map to 2 API sections each). */
export const WIZARD_STEP_KEYS = [
  "product_basics",
  "product_area",
  "business_goal",
  "customer_segment",
  "pricing_tier",
  "competitor",
  "roadmap_existing",
  "roadmap_planned",
  "team",
  "tech_stack",
] as const;

export type WizardStepKey = (typeof WIZARD_STEP_KEYS)[number];

/** Step 1: Product basics. */
export interface ProductBasics {
  product_name: string;
  description?: string;
  industry?: string;
  stage?: string;
  website_url?: string;
}

/** Step 2: Single product area. */
export interface ProductArea {
  id?: string;
  name: string;
  description?: string;
  order?: number;
}

/** Step 3: Single business goal. */
export interface BusinessGoal {
  id?: string;
  title: string;
  description?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  time_period?: string;
  linked_area?: string;
}

/** Step 4: Customer segment. */
export interface CustomerSegment {
  id?: string;
  name: string;
  description?: string;
  revenue_share?: number;
}

/** Step 4: Pricing tier. */
export interface PricingTier {
  id?: string;
  name: string;
  price?: number;
  period?: "monthly" | "yearly";
  target_segment?: string;
}

/** Step 5: Competitor. */
export interface Competitor {
  id?: string;
  name: string;
  strengths?: string;
  weaknesses?: string;
  differentiation?: string;
}

/** Step 6: Existing feature. */
export interface RoadmapExisting {
  id?: string;
  name: string;
  status?: "Live" | "Beta" | "Alpha" | "Deprecated";
  linked_area?: string;
}

/** Step 6: Planned feature. */
export interface RoadmapPlanned {
  id?: string;
  name: string;
  status?: "Planned" | "In Progress" | "Blocked";
  priority?: "P0" | "P1" | "P2" | "P3";
  target_date?: string;
  linked_area?: string;
}

/** Step 7: Team. */
export interface Team {
  id?: string;
  name: string;
  lead?: string;
  owns_areas?: string[];
  size?: number;
  slack_channel?: string;
}

/** Step 8: Tech stack entry. */
export interface TechStackItem {
  id?: string;
  category: string;
  technology: string;
  notes?: string;
}

/** Onboarding status from API. */
export interface OnboardingStatus {
  has_product_context: boolean;
  has_feedback: boolean;
  has_customers: boolean;
  onboarding_complete: boolean;
}

/** Product context item (list sections). */
export interface ProductContextItem {
  id: string;
  data: Record<string, unknown>;
}

/** Full product context from GET /product-context. */
export interface ProductContextAll {
  product_basics: Record<string, unknown>;
  product_area: ProductContextItem[];
  business_goal: ProductContextItem[];
  customer_segment: ProductContextItem[];
  pricing_tier: ProductContextItem[];
  competitor: ProductContextItem[];
  roadmap_existing: ProductContextItem[];
  roadmap_planned: ProductContextItem[];
  team: ProductContextItem[];
  tech_stack: ProductContextItem[];
}

/** Bulk section payload for POST /product-context/bulk. */
export interface BulkSectionPayload {
  section: string;
  data?: Record<string, unknown>;
  items?: { data: Record<string, unknown> }[];
}
