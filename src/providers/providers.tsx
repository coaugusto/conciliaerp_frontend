"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState } from "react";
import { api, type ApiResponse } from "@/services/api/client";

type User = { name: string; email: string; role: "ADMIN" | "ANALYST"; mustChangePassword?: boolean };
type AuthContextValue = { user: User | null; login: (email: string, password: string) => Promise<User>; logout: () => void; changePassword: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
const getStored = () => typeof window === "undefined" ? null : localStorage.getItem("concilia_user");
const useMocks = () => process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } }));
  const [user, setUser] = useState<User | null>(() => { const s = getStored(); return s ? JSON.parse(s) : null; });
  const login = async (email: string, password: string) => {
    if (!useMocks()) {
      const response = await api.post<ApiResponse<{ accessToken:string; user:User }>>("/auth/login", { email, password });
      const payload = response.data.data;
      localStorage.setItem("concilia_user", JSON.stringify(payload.user)); localStorage.setItem("concilia_token", payload.accessToken); setUser(payload.user);
      return payload.user;
    }
    await new Promise(r => setTimeout(r, 650));
    if (!password || !email.includes("@")) throw new Error("Credenciais inválidas. Confira seu e-mail e senha.");
    const next: User = { name: email.startsWith("analista") ? "Mariana Costa" : "Carlos Almeida", email, role: email.startsWith("analista") ? "ANALYST" : "ADMIN", mustChangePassword: password === "primeiroacesso" };
    localStorage.setItem("concilia_user", JSON.stringify(next)); localStorage.setItem("concilia_token", "mock-jwt-token"); setUser(next); return next;
  };
  const logout = () => { localStorage.removeItem("concilia_user"); localStorage.removeItem("concilia_token"); setUser(null); };
  const changePassword = () => { if (!user) return; const next = { ...user, mustChangePassword: false }; localStorage.setItem("concilia_user", JSON.stringify(next)); setUser(next); };
  return <QueryClientProvider client={client}><AuthContext.Provider value={{ user, login, logout, changePassword }}>{children}</AuthContext.Provider></QueryClientProvider>;
}
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider ausente"); return value; };
