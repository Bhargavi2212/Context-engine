import axios from "axios";
import { API_BASE_URL, TOKEN_KEY } from "../utils/constants";
import type { ApiResponse } from "../types/common";
import type { User, LoginRequest, SignupRequest, AuthResponse } from "../types/auth";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // For FormData, remove Content-Type so browser sets multipart/form-data with boundary
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export async function login(req: LoginRequest) {
  const { data } = await api.post<ApiResponse<AuthResponse>>("/auth/login", req);
  return data;
}

export async function signup(req: SignupRequest) {
  const { data } = await api.post<ApiResponse<AuthResponse>>("/auth/signup", req);
  return data;
}

export async function getMe() {
  const { data } = await api.get<ApiResponse<User>>("/auth/me");
  return data;
}

export interface HealthData {
  status: string;
  database: string;
  mistral: string;
  version?: string;
}

export async function getHealth() {
  const { data } = await api.get<ApiResponse<HealthData>>("/health");
  return data;
}
