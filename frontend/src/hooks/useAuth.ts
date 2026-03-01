import { useState, useEffect, useCallback } from "react";
import * as apiService from "../services/api";
import { TOKEN_KEY } from "../utils/constants";
import type { User, LoginRequest, SignupRequest } from "../types/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await apiService.getMe();
      setUser(data.data);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (req: LoginRequest) => {
    const data = await apiService.login(req);
    localStorage.setItem(TOKEN_KEY, data.data.access_token);
    setUser(data.data.user);
  }, []);

  const signup = useCallback(async (req: SignupRequest) => {
    const data = await apiService.signup(req);
    localStorage.setItem(TOKEN_KEY, data.data.access_token);
    setUser(data.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    signup,
    logout,
  };
}
