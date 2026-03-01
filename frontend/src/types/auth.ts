export interface User {
  user_id: string;
  email: string;
  full_name: string;
  org_id: string;
  org_name: string;
  role: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  org_name: string;
}
