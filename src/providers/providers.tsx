"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { api, type ApiResponse } from "@/services/api/client";
import { BackgroundCompletionNotifier } from "@/components/layout/background-completion-notifier";

export type User = { name:string; email:string; role:"ADMIN"|"COMPANY_ADMIN"|"ANALYST"; mustChangePassword?:boolean; jobTitle?:string|null; phone?:string|null; twoFactorEnabled?:boolean };
// Resultado do login em etapas: entrou, falta o código do 2FA ou falta cadastrar o autenticador.
export type LoginStep = { step:"done"; user:User; recoveryCodes?:string[]; recoveryCodesRemaining?:number } | { step:"2fa"|"2fa-setup"; challengeToken:string };
type LoginPayload = { accessToken:string; user:User; tenants?:ClientAccess[]; recoveryCodes?:string[]; recoveryCodesRemaining?:number };
type Theme = "light"|"dark";
type ClientAccess = { id:string; name:string; cncCode:string };
type AuthContextValue = { user:User|null; hydrated:boolean; login:(email:string,password:string)=>Promise<LoginStep>; verifyTwoFactor:(challengeToken:string,code:string)=>Promise<LoginStep>; confirmTwoFactorSetup:(challengeToken:string,code:string)=>Promise<LoginStep>; logout:()=>void; changePassword:(currentPassword:string,newPassword:string)=>Promise<void>; updateProfile:(profile:Pick<User,"name"|"jobTitle"|"phone">)=>Promise<void>; theme:Theme; toggleTheme:()=>void };
const AuthContext = createContext<AuthContextValue|null>(null);
const getStored = () => typeof window === "undefined" ? null : localStorage.getItem("concilia_user");
const subscribeToHydration = () => () => undefined;

export function Providers({children}:{children:React.ReactNode}) {
  const [client] = useState(() => new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30_000}}}));
  const [user,setUser] = useState<User|null>(() => { const stored=getStored(); return stored?JSON.parse(stored):null; });
  const [theme,setTheme] = useState<Theme>(() => typeof window!=="undefined"&&localStorage.getItem("concilia_theme")==="dark"?"dark":"light");
  const hydrated=useSyncExternalStore(subscribeToHydration,()=>true,()=>false);
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
  const finishLogin=async(payload:LoginPayload):Promise<LoginStep>=>{
    let token=payload.accessToken;const tenantId=payload.tenants?.[0]?.id;
    ["concilia_tenant_id","concilia_tenant_name","concilia_cnc_code","concilia_company_id"].forEach(key=>localStorage.removeItem(key));localStorage.setItem("concilia_token",token);
    try { if(tenantId){const selection=await api.post<ApiResponse<{accessToken:string;tenant:ClientAccess}>>("/auth/select-tenant",{tenantId});token=selection.data.data.accessToken;localStorage.setItem("concilia_tenant_id",selection.data.data.tenant.id);localStorage.setItem("concilia_tenant_name",selection.data.data.tenant.name);localStorage.setItem("concilia_cnc_code",selection.data.data.tenant.cncCode);}} catch(error){localStorage.removeItem("concilia_token");localStorage.removeItem("concilia_tenant_id");throw error;}
    localStorage.setItem("concilia_user",JSON.stringify(payload.user));localStorage.setItem("concilia_token",token);setUser(payload.user);return {step:"done",user:payload.user,recoveryCodes:payload.recoveryCodes,recoveryCodesRemaining:payload.recoveryCodesRemaining};
  };
  const login=async(email:string,password:string):Promise<LoginStep>=>{
    const payload=(await api.post<ApiResponse<LoginPayload&{twoFactorRequired?:boolean;twoFactorSetupRequired?:boolean;challengeToken?:string}>>("/auth/login",{email,password})).data.data;
    if(payload.twoFactorRequired&&payload.challengeToken)return {step:"2fa",challengeToken:payload.challengeToken};
    if(payload.twoFactorSetupRequired&&payload.challengeToken)return {step:"2fa-setup",challengeToken:payload.challengeToken};
    return finishLogin(payload);
  };
  const verifyTwoFactor=async(challengeToken:string,code:string)=>finishLogin((await api.post<ApiResponse<LoginPayload>>("/auth/2fa/verify",{challengeToken,code})).data.data);
  const confirmTwoFactorSetup=async(challengeToken:string,code:string)=>finishLogin((await api.post<ApiResponse<LoginPayload>>("/auth/2fa/setup/challenge/confirm",{challengeToken,code})).data.data);
  const logout=()=>{["concilia_user","concilia_token","concilia_tenant_id","concilia_tenant_name","concilia_cnc_code","concilia_company_id"].forEach(key=>localStorage.removeItem(key));setUser(null);};
  const persistUser=(next:User)=>{localStorage.setItem("concilia_user",JSON.stringify(next));setUser(next);};
  // A troca derruba as outras sessões; esta continua com o token novo que a API devolve.
  const changePassword=async(currentPassword:string,newPassword:string)=>{const result=(await api.post<ApiResponse<{accessToken?:string}>>("/auth/change-password",{currentPassword,newPassword})).data.data;if(result?.accessToken)localStorage.setItem("concilia_token",result.accessToken);if(user)persistUser({...user,mustChangePassword:false});};
  const updateProfile=async(profile:Pick<User,"name"|"jobTitle"|"phone">)=>{const next=(await api.patch<ApiResponse<Pick<User,"name"|"email"|"jobTitle"|"phone">>>("/access-profile/me",profile)).data.data;if(user)persistUser({...user,...next});};
  const toggleTheme=()=>setTheme(current=>current==="dark"?"light":"dark");
  return <QueryClientProvider client={client}><AuthContext.Provider value={{user:hydrated?user:null,hydrated,login,verifyTwoFactor,confirmTwoFactorSetup,logout,changePassword,updateProfile,theme:hydrated?theme:"light",toggleTheme}}><BackgroundCompletionNotifier />{children}</AuthContext.Provider></QueryClientProvider>;
}
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error("AuthProvider ausente");return value;};
