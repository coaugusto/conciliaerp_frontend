"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Card, ErrorState, PageLoader } from "@/components/shared/ui";
import { FieldHelp } from "@/components/help/field-help";
import { api, getApiErrorMessage, type ApiResponse } from "@/services/api/client";

type Security = { requireTwoFactor: boolean };

// Exigir 2FA de todos os usuários deste cliente. A equipe interna (ADMIN e analistas) já é sempre
// obrigada; isto estende a regra ao administrador do cliente e demais usuários dele.
export function SecurityCard() {
  const queryClient = useQueryClient();
  const security = useQuery({ queryKey: ["tenant-security"], queryFn: async () => (await api.get<ApiResponse<Security>>("/commercial/security")).data.data });
  const save = useMutation({ mutationFn: async (requireTwoFactor: boolean) => (await api.put<ApiResponse<Security>>("/commercial/security", { requireTwoFactor })).data.data, onSuccess: data => queryClient.setQueryData(["tenant-security"], data) });
  if (security.isLoading) return <Card className="p-5"><PageLoader /></Card>;
  if (security.isError) return <ErrorState message={getApiErrorMessage(security.error)} />;
  return <Card data-help="seguranca-2fa" className="max-w-3xl p-5">
    <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-cyan-700" size={22} /><div className="flex-1">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 size-4 accent-cyan-700" checked={security.data?.requireTwoFactor ?? false} disabled={save.isPending} onChange={event => save.mutate(event.target.checked)} />
        <span><b className="text-slate-900">Exigir verificação em duas etapas de todos os usuários deste cliente</b><FieldHelp screen="commercial" field="seguranca-2fa" />
          <span className="mt-1 block text-sm text-slate-500">No próximo login, quem ainda não tem o aplicativo autenticador cadastrado é levado a cadastrar antes de entrar. A equipe interna já é sempre obrigada.</span></span>
      </label>
      {save.isError && <div className="mt-3"><ErrorState message={getApiErrorMessage(save.error)} /></div>}
    </div></div>
  </Card>;
}
