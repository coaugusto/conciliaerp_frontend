import axios from "axios";
export type ApiResponse<T> = { success: boolean; data: T; message: string };
// 12s cancelava chamadas legítimas para tenants grandes (ex.: /alerts fiscal-summary passa disso
// quando o cache de 4h expira e precisa recalcular — ver FISCAL_PRODUCTS_CACHE_TTL_MS) — o
// cancelamento por si só já causa fila/nova tentativa disputando as poucas conexões simultâneas
// que o navegador permite por domínio, o que piora ainda mais o carregamento da tela.
export const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1", timeout: 30_000 });
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error?.message ?? error.response?.data?.message;
    return Array.isArray(message) ? message.join(", ") : message ?? error.response?.data?.error ?? error.message ?? "Erro ao processar a solicitação.";
  }
  return error instanceof Error ? error.message : "Erro inesperado.";
}
api.interceptors.request.use(config => { if (typeof window !== "undefined") { const token = localStorage.getItem("concilia_token"); const tenantId = localStorage.getItem("concilia_tenant_id"); const companyId = localStorage.getItem("concilia_company_id"); if (token) config.headers.Authorization = `Bearer ${token}`; if (tenantId) config.headers["X-Tenant-Id"] = tenantId; const isClientContextRequest = config.url?.startsWith("/client-context/clients"); if (companyId && !isClientContextRequest) config.headers["X-Company-Id"] = companyId; } return config; });
api.interceptors.response.use(r => r, error => { if (error.response?.status === 401 && typeof window !== "undefined") { localStorage.removeItem("concilia_token"); localStorage.removeItem("concilia_user"); window.location.assign("/login"); } return Promise.reject(error); });
