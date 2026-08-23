"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { api, type ApiResponse } from "@/services/api/client";

export type User = { name: string; email: string; role: "ADMIN" | "COMPANY_ADMIN" | "ANALYST"; mustChangePassword?: boolean; jobTitle?: string | null; phone?: string | null };
type Theme = "light" | "dark";
type AuthContextValue = { user: User | null; login: (email: string, password: string) => Promise<User>; logout: () => void; changePassword: (currentPassword: string, newPassword: string) => Promise<void>; updateProfile: (profile: Pick<User, "name" | "jobTitle" | "phone">) => Promise<void>; theme: Theme; toggleTheme: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
const getStored = () => typeof window === "undefined" ? null : localStorage.getItem("concilia_user");
const isMocksEnabled = () => process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
  const [user, setUser] = useState<User | null>(() => { const s = getStored(); return s ? JSON.parse(s) : null; });
  const [theme, setTheme] = useState<Theme>(() => typeof window !== "undefined" && localStorage.getItem("concilia_theme") === "dark" ? "dark" : "light");
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem("concilia_theme", theme); }, [theme]);
  useEffect(() => { (async () => {
    if (isMocksEnabled() || !user || localStorage.getItem("concilia_tenant_id") || !localStorage.getItem("concilia_token")) return;
    try {
      const tenants = (await api.get<ApiResponse<{ id: string; name: string; cncCode: string }[]>>("/auth/tenants")).data.data;
      const tenantId = tenants[0]?.id;
      if (!tenantId) return;
      const selection = await api.post<ApiResponse<{ accessToken: string; tenant: { id: string; name: string; cncCode: string } }>>("/auth/select-tenant", { tenantId });
      localStorage.setItem("concilia_tenant_id", selection.data.data.tenant.id);
      localStorage.setItem("concilia_tenant_name", selection.data.data.tenant.name);
      localStorage.setItem("concilia_cnc_code", selection.data.data.tenant.cncCode);
      localStorage.setItem("concilia_token", selection.data.data.accessToken);
      window.dispatchEvent(new Event("concilia:tenant-changed"));
    } catch { /* The user can still select a tenant after a new login. */ }
  })(); }, [user]);
  const login = async (email: string, password: string) => {
    if (!isMocksEnabled()) {
      const response = await api.post<ApiResponse<{ accessToken:string; user:User; tenants?:{id:string;name:string;cncCode:string}[] }>>("/auth/login", { email, password });
      const payload = response.data.data;
      let token = payload.accessToken; const tenantId = payload.tenants?.[0]?.id;
      // The tenant-selection endpoint is protected. Persist the freshly issued
      // login token before the request so the interceptor never reuses a stale
      // token left by a previous session.
      localStorage.setItem("concilia_token", token);
      try {
        if (tenantId) { const selection = await api.post<ApiResponse<{accessToken:string;tenant:{id:string;name:string;cncCode:string}}>>("/auth/select-tenant", { tenantId }); token = selection.data.data.accessToken; localStorage.setItem("concilia_tenant_id", selection.data.data.tenant.id); localStorage.setItem("concilia_tenant_name", selection.data.data.tenant.name); localStorage.setItem("concilia_cnc_code", selection.data.data.tenant.cncCode); }
      } catch (error) { localStorage.removeItem("concilia_token"); localStorage.removeItem("concilia_tenant_id"); throw error; }
      localStorage.setItem("concilia_user", JSON.stringify(payload.user)); localStorage.setItem("concilia_token", token); setUser(payload.user);
      return payload.user;
    }
    await new Promise(r => setTimeout(r, 650));
    if (!password || !email.includes("@")) throw new Error("Credenciais inválidas. Confira seu e-mail e senha.");
    const next: User = { name: email.startsWith("analista") ? "Mariana Costa" : "Carlos Almeida", email, role: email.startsWith("analista") ? "ANALYST" : "ADMIN", mustChangePassword: password === "primeiroacesso" };
    localStorage.setItem("concilia_user", JSON.stringify(next)); localStorage.setItem("concilia_token", "mock-jwt-token"); setUser(next); return next;
  };
  const logout = () => { localStorage.removeItem("concilia_user"); localStorage.removeItem("concilia_token"); localStorage.removeItem("concilia_tenant_id"); localStorage.removeItem("concilia_tenant_name"); localStorage.removeItem("concilia_cnc_code"); localStorage.removeItem("concilia_company_id"); setUser(null); };
  const persistUser = (next: User) => { localStorage.setItem("concilia_user", JSON.stringify(next)); setUser(next); };
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!isMocksEnabled()) await api.post("/auth/change-password", { currentPassword, newPassword });
    if (user) persistUser({ ...user, mustChangePassword: false });
  };
  const updateProfile = async (profile: Pick<User, "name" | "jobTitle" | "phone">) => {
    const next = isMocksEnabled() ? profile : (await api.patch<ApiResponse<Pick<User, "name" | "email" | "jobTitle" | "phone">>>("/access-profile/me", profile)).data.data;
    if (user) persistUser({ ...user, ...next });
  };
  const toggleTheme = () => setTheme(current => current === "dark" ? "light" : "dark");
  return <QueryClientProvider client={client}><AuthContext.Provider value={{ user, login, logout, changePassword, updateProfile, theme, toggleTheme }}>{children}</AuthContext.Provider></QueryClientProvider>;
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider ausente"); return value; };
