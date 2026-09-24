import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/services/api/client";

// "Quais das minhas próprias concessões pontuais valem neste tenant?" — usado pra decidir se
// mostra uma aba/botão normalmente escondido do papel ANALYST (Cadastros, Connector, Operação,
// Carga inicial, SELECT das consultas), sem duplicar a regra "ADMIN/COMPANY_ADMIN sempre podem"
// no frontend — o backend já resolve isso e devolve o catálogo inteiro liberado pra esses papéis.
export function useMyAccessPermissions(tenantId?: string) {
  const query = useQuery({
    queryKey: ["my-access-permissions", tenantId ?? null],
    queryFn: async () => (await api.get<ApiResponse<{ codes: string[] }>>("/access-permissions/me")).data.data.codes,
  });
  return { codes: query.data ?? [], has: (code: string) => (query.data ?? []).includes(code), isLoading: query.isLoading };
}
