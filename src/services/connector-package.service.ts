import { api, type ApiResponse } from "./api/client";

export type ConnectorPackageInfo = { available: false } | { available: true; fileName: string; sizeBytes: number; contentType: string; uploadedAt: string };

export const connectorPackageService = {
  info: async () => (await api.get<ApiResponse<ConnectorPackageInfo>>("/connector-package")).data.data,
  // O upload pode passar dos 30s padrão do client (client.ts) sem que o servidor esteja lento —
  // é o tempo de TRANSFERÊNCIA de até 50MB (o limite do backend) que pode estourar isso sozinho
  // numa conexão de upload mais lenta, mesmo que o Connector-package em si suba rápido no backend.
  // 5 minutos cobre até conexões bem lentas sem deixar a tela travada pra sempre se realmente
  // travar.
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await api.post<ApiResponse<ConnectorPackageInfo>>("/connector-package", form, { timeout: 300_000 })).data.data;
  },
  // responseType "blob" passa pelo mesmo axios com o header de autenticação (o link teria que ser
  // anônimo pra funcionar direto num <a href>, e o download é sempre autenticado por tenant).
  download: async (fileName: string) => {
    const response = await api.get("/connector-package/download", { responseType: "blob", timeout: 300_000 });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  remove: async () => (await api.delete<ApiResponse<{ deleted: boolean }>>("/connector-package")).data.data,
};
