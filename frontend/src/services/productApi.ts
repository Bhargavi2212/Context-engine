import { api } from "./api";
import type { ApiResponse } from "../types/common";
import type {
  BulkSectionPayload,
  OnboardingStatus,
  ProductContextAll,
  ProductContextItem,
} from "../types/product";

/** Get onboarding status. */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const { data } = await api.get<ApiResponse<OnboardingStatus>>(
    "/onboarding/status"
  );
  return data.data;
}

/** Get all product context for current org. */
export async function getProductContextAll(): Promise<ProductContextAll> {
  const { data } = await api.get<ApiResponse<ProductContextAll>>("/product-context/");
  return data.data;
}

/** Get items for a specific section. */
export async function getProductContextSection(
  section: string
): Promise<ProductContextItem[] | Record<string, unknown>> {
  const { data } = await api.get<ApiResponse<ProductContextItem[] | Record<string, unknown>>>(
    `/product-context/${section}`
  );
  return data.data;
}

/** Create a single product context item. */
export async function postProductContextItem(
  section: string,
  itemData: Record<string, unknown>
): Promise<{ id: string; section: string; data: Record<string, unknown> }> {
  const { data } = await api.post<
    ApiResponse<{ id: string; org_id: string; section: string; data: Record<string, unknown> }>
  >("/product-context/", { section, data: itemData });
  return data.data;
}

/** Update a single product context item. */
export async function putProductContextItem(
  id: string,
  itemData: Record<string, unknown>
): Promise<{ id: string; section: string; data: Record<string, unknown> }> {
  const { data } = await api.put<
    ApiResponse<{ id: string; org_id: string; section: string; data: Record<string, unknown> }>
  >(`/product-context/${id}`, { data: itemData });
  return data.data;
}

/** Delete a single product context item. */
export async function deleteProductContextItem(id: string): Promise<void> {
  await api.delete(`/product-context/${id}`);
}

/** Bulk save entire wizard (all sections). */
export async function postProductContextBulk(
  sections: BulkSectionPayload[]
): Promise<{ count: number }> {
  const { data } = await api.post<ApiResponse<{ count: number }>>(
    "/product-context/bulk",
    { sections }
  );
  return data.data;
}
