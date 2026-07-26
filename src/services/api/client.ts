import axios from "axios";
export type ApiResponse<T> = { success: boolean; data: T; message: string };
export const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001", timeout: 12_000 });
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(", ") : message ?? error.response?.data?.error ?? error.message ?? "Erro ao processar a solicitação.";
  }
  return error instanceof Error ? error.message : "Erro inesperado.";
}
api.interceptors.request.use(config => { if (typeof window !== "undefined") { const token = localStorage.getItem("concilia_token"); if (token) config.headers.Authorization = `Bearer ${token}`; } return config; });
api.interceptors.response.use(r => r, error => { if (error.response?.status === 401 && typeof window !== "undefined") { localStorage.removeItem("concilia_token"); localStorage.removeItem("concilia_user"); window.location.assign("/login"); } return Promise.reject(error); });
