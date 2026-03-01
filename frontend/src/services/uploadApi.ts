import { api } from "./api";
import type {
  UploadParse,
  ImportFeedbackRequest,
  ImportFeedbackResponse,
  ImportCustomerResponse,
  UploadStatus,
  UploadHistoryItem,
} from "../types/upload";

const PREFIX = "/upload";

/** Parse feedback CSV/TSV (step 1). Returns upload_id, columns, suggested_mapping, preview. */
export async function parseFeedback(file: File): Promise<UploadParse> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{ data: UploadParse }>(`${PREFIX}/feedback`, formData);
  return data.data;
}

/** Start feedback import (background). Use getStatus to poll for completion. */
export async function importFeedback(
  body: ImportFeedbackRequest
): Promise<{ upload_id: string }> {
  const { data } = await api.post<{ data: { upload_id: string } }>(
    `${PREFIX}/feedback/import`,
    body
  );
  return data.data;
}

/** Parse customer CSV/TSV (step 1). */
export async function parseCustomers(file: File): Promise<UploadParse> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<{ data: UploadParse }>(`${PREFIX}/customers`, formData);
  return data.data;
}

/** Start customer import (background). */
export async function importCustomers(
  uploadId: string,
  columnMapping: Record<string, string>
): Promise<{ upload_id: string }> {
  const { data } = await api.post<{ data: { upload_id: string } }>(
    `${PREFIX}/customers/import`,
    { upload_id: uploadId, column_mapping: columnMapping }
  );
  return data.data;
}

/** Get upload progress for polling. */
export async function getStatus(uploadId: string): Promise<UploadStatus> {
  const { data } = await api.get<{ data: UploadStatus }>(
    `${PREFIX}/${uploadId}/status`
  );
  return data.data;
}

/** List upload history. */
export async function getHistory(): Promise<UploadHistoryItem[]> {
  const { data } = await api.get<{ data: UploadHistoryItem[] }>(
    `${PREFIX}/history`
  );
  return data.data;
}
