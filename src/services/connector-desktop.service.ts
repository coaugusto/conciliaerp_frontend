import { api, type ApiResponse } from './api/client';

export type ConnectorDesktopRelease = {
  available: boolean;
  version: string | null;
  platform: 'windows';
  architecture: 'x64';
  fileName: string | null;
  downloadUrl: string | null;
  sha256: string | null;
  message?: string;
};

export const connectorDesktopService = {
  release: async () => (await api.get<ApiResponse<ConnectorDesktopRelease>>('/connector-desktop/release')).data.data,
};
