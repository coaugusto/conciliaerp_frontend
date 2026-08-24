"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { api, type ApiResponse } from "@/services/api/client";

export type User = { name:string; email:string; role:"ADMIN"|"COMPANY_ADMIN"|"ANALYST"; mustChangePassword?:boolean; jobTitle?:string|null; phone?:string|null };
type Theme = "light"|"dark";
type ClientAccess = { id:string; name:string; cncCode:string };
type AuthContextValue = { user:User|null; login:(email:string,password:string)=>Promise<User>; logout:()=>void; changePassword:(currentPassword:string,newPassword:string)=>Promise<void>; updateProfile:(profile:Pick<User,"name"|"jobTitle"|"phone">)=>Promise<void>; theme:Theme; toggleTheme:()=>void };
const AuthContext = createContext<AuthContextValue|null>(null);
const getStored = () => typeof window === "undefined" ? null : localStorage.getItem("concilia_user");

export function Providers({children}:{children:React.ReactNode}) {
  const [client] = useState(() => new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30_000}}}));
  const [user,setUser] = useState<User|null>(() => { const stored=getStored(); return stored?JSON.parse(stored):null; });
  const [theme,setTheme] = useState<Theme>(() => typeof window!=="undefined"&&localStorage.getItem("concilia_theme")==="dark"?"dark":"light");
  useEffect(()=>{document.documentElement.classList.toggle("dark",theme==="dark");localStorage.setItem("concilia_theme",theme);},[theme]);
  useEffect(()=>{(async()=>{
    if(!user||localStorage.getItem("concilia_tenant_id")||!localStorage.getItem("concilia_token"))return;
    try {
      const clients=(await api.get<ApiResponse<ClientAccess[]>>("/auth/tenants")).data.data;
      const tenantId=clients[0]?.id;if(!tenantId)return;
      const selection=await api.post<ApiResponse<{accessToken:string;tenant:ClientAccess}>>("/auth/select-tenant",{tenantId});
      localStorage.setItem("concilia_tenant_id",selection.data.data.tenant.id);localStorage.setItem("concilia_tenant_name",selection.data.data.tenant.name);localStorage.setItem("concilia_cnc_code",selection.data.data.tenant.cncCode);localStorage.setItem("concilia_token",selection.data.data.accessToken);window.dispatchEvent(new Event("concilia:tenant-changed"));
    } catch { /* The header exposes API errors. */ }
  })();},[user]);
  const login=async(email:string,password:string)=>{
    const payload=(await api.post<ApiResponse<{accessToken:string;user:User;tenants?:ClientAccess[]}>>("/auth/login",{email,password})).data.data;
    let token=payload.accessToken;const tenantId=payload.tenants?.[0]?.id;
    ["concilia_tenant_id","concilia_tenant_name","concilia_cnc_code","concilia_company_id"].forEach(key=>localStorage.removeItem(key));localStorage.setItem("concilia_token",token);
    try { if(tenantId){const selection=await api.post<ApiResponse<{accessToken:string;tenant:ClientAccess}>>("/auth/select-tenant",{tenantId});token=selection.data.data.accessToken;localStorage.setItem("concilia_tenant_id",selection.data.data.tenant.id);localStorage.setItem("concilia_tenant_name",selection.data.data.tenant.name);localStorage.setItem("concilia_cnc_code",selection.data.data.tenant.cncCode);}} catch(error){localStorage.removeItem("concilia_token");localStorage.removeItem("concilia_tenant_id");throw error;}
    localStorage.setItem("concilia_user",JSON.stringify(payload.user));localStorage.setItem("concilia_token",token);setUser(payload.user);return payload.user;
  };
  const logout=()=>{["concilia_user","concilia_token","concilia_tenant_id","concilia_tenant_name","concilia_cnc_code","concilia_company_id"].forEach(key=>localStorage.removeItem(key));setUser(null);};
  const persistUser=(next:User)=>{localStorage.setItem("concilia_user",JSON.stringify(next));setUser(next);};
  const changePassword=async(currentPassword:string,newPassword:string)=>{await api.post("/auth/change-password",{currentPassword,newPassword});if(user)persistUser({...user,mustChangePassword:false});};
  const updateProfile=async(profile:Pick<User,"name"|"jobTitle"|"phone">)=>{const next=(await api.patch<ApiResponse<Pick<User,"name"|"email"|"jobTitle"|"phone">>>("/access-profile/me",profile)).data.data;if(user)persistUser({...user,...next});};
  const toggleTheme=()=>setTheme(current=>current==="dark"?"light":"dark");
  return <QueryClientProvider client={client}><AuthContext.Provider value={{user,login,logout,changePassword,updateProfile,theme,toggleTheme}}>{children}</AuthContext.Provider></QueryClientProvider>;
}
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error("AuthProvider ausente");return value;};
