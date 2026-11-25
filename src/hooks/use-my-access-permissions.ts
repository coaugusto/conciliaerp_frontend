import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/services/api/client";

// "Quais das minhas próprias concessões pontuais valem neste tenant?" — usado pra decidir se
// mostra uma aba/botão normalmente escondido do papel ANALYST (Cadastros, Connector, Operação,
// Carga inicial, SELECT das consultas), sem duplicar a regra "ADMIN/COMPANY_ADMIN sempre podem"
// no frontend — o backend já resolve isso e devolve o catálogo inteiro liberado pra esses papéis.
// Telas de detalhe seguem a liberação da tela principal (mesma regra de client-screens.ts no backend).
const SCREEN_PARENT: Record<string, string> = { "INT-05": "INT-04", "INT-06": "INT-04", "INT-07": "INT-04" };

export function useMyAccessPermissions(tenantId?: string, enabled = true) {
  const query = useQuery({
    enabled,
    queryKey: ["my-access-permissions", tenantId ?? null],
    queryFn: async () => (await api.get<ApiResponse<{ codes: string[]; screens?: string[] | null }>>("/access-permissions/me")).data.data,
  });
  const codes = query.data?.codes ?? [];
  // screens: null/undefined = sem restrição de telas; lista = só estas (liberação por usuário do
  // cliente, em Portal do Cliente → Cadastros). A API exclusiva de cada tela também confere.
  const screens = query.data?.screens ?? null;
  const screenAllowed = (code: string) => screens === null || screens.includes(code) || screens.includes(SCREEN_PARENT[code] ?? "");
  return { codes, has: (code: string) => codes.includes(code), screens, screenAllowed, isLoading: query.isLoading };
}
