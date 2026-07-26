import { api, type ApiResponse } from "./api/client";
export const authService = { login: (email:string,password:string) => api.post<ApiResponse<{token:string}>>("/auth/login",{email,password}), changePassword:(currentPassword:string,newPassword:string)=>api.post("/auth/change-password",{currentPassword,newPassword}) };
