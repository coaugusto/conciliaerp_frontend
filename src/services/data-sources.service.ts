import { api, type ApiResponse } from "./api/client";

export type DataSourceFieldSummary = {
  id: string;
  fieldName: string;
  label: string;
  oracleDataType: string;
  semanticType: string;
  required: boolean;
  active: boolean;
};

export type DataSourceSummary = {
  id: string;
  connectionId: string;
  name: string;
  description?: string | null;
  sourceType: string;
  schemaName: string;
  tableName: string;
  active: boolean;
  fields: DataSourceFieldSummary[];
};

type DataSourceListResponse = {
  items: DataSourceSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const dataSourcesService = {
  list: async () => (await api.get<ApiResponse<DataSourceListResponse>>("/data-sources")).data.data,
};
