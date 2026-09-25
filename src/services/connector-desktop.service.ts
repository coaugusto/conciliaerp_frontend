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
  // Só usado quando downloadUrl é o endpoint interno (release do GitHub é privada — o link de asset
  // não é público, então o backend busca com um token e repassa aqui, autenticado como o resto da
  // API). Timeout maior porque o instalador tem ~150MB e o backend ainda faz o proxy até o GitHub
  // antes de começar a responder.
  download: async (fileName: string) => {
    const response = await api.get('/connector-desktop/download', { responseType: 'blob', timeout: 300_000 });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
