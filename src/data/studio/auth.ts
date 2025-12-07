import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

const API_BASE = "/api/auth";

export function requestPasswordReset(email: string) {
  return api.post(`${API_BASE}/password-reset/request`, { email });
}

export function validateResetToken(token: string) {
  return api.get(`${API_BASE}/password-reset/validate`, { params: { token } });
}

export function confirmPasswordReset(token: string, password: string) {
  return api.post(`${API_BASE}/password-reset/confirm`, { token, password });
}
