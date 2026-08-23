import { api, type ApiResponse } from "./api/client";

export type ClientContext = { id: string; documentRoot: string; matrixCnpj: string; legalName: string; tradeName: string | null; state: string | null; branches: number; companyIds: string[] };
export const clientContextService = { list: async () => (await api.get<ApiResponse<ClientContext[]>>("/client-context/clients")).data.data };
