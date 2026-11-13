import { api, type ApiResponse } from "./api/client";

// Assistente de ajuda das telas (backend: src/help-assistant). A documentação de cada tela é fixa e
// escrita pela equipe; o assistente nunca recebe dados do cliente, só a pergunta digitada.

export type HelpStep = { target: string | null; text: string; prepare?: string };
export type HelpTopicRef = { id: string; title: string };
export type HelpTopic = HelpTopicRef & { steps: HelpStep[] };
export type HelpField = { id: string; label: string; short: string; example?: string; topicId?: string };
export type HelpDocSummary = { screen: string; title: string; routes: string[]; layoutVersion: string };
export type HelpDoc = HelpDocSummary & { tourTopicId: string; whatsNew: HelpStep[]; topics: HelpTopic[]; fields: HelpField[] };
export type HelpAnswer =
  | { found: false; source: "doc" | "model"; related: HelpTopicRef[] }
  | { found: true; source: "doc" | "model"; screen: string; topic: HelpTopicRef; steps: HelpStep[]; related: HelpTopicRef[] };

export const PORTAL_HELP_SCREEN = "portal";

/** Documentação que atende a rota (prefixo mais longo); sem nenhuma, a ajuda geral do portal. */
export function helpScreenForPath(path: string, docs: HelpDocSummary[]): string {
  const pathname = path.split("?")[0];
  let best: { screen: string; length: number } | null = null;
  for (const doc of docs) for (const route of doc.routes) {
    if ((pathname === route || pathname.startsWith(`${route}/`)) && (!best || route.length > best.length)) best = { screen: doc.screen, length: route.length };
  }
  return best?.screen ?? PORTAL_HELP_SCREEN;
}

export const helpService = {
  list: async () => (await api.get<ApiResponse<HelpDocSummary[]>>("/help")).data.data,
  doc: async (screen: string) => (await api.get<ApiResponse<HelpDoc>>(`/help/${encodeURIComponent(screen)}`)).data.data,
  ask: async (screen: string, question: string) => (await api.post<ApiResponse<HelpAnswer>>(`/help/${encodeURIComponent(screen)}/ask`, { question })).data.data,
  progress: async () => (await api.get<ApiResponse<Record<string, string>>>("/help/progress")).data.data,
  markSeen: async (screen: string, layoutVersion: string) => { await api.put(`/help/progress/${encodeURIComponent(screen)}`, { layoutVersion }); },
};

// "Saiba mais" do <FieldHelp> abre o assistente já no tópico do campo.
export const HELP_OPEN_TOPIC_EVENT = "concilia:help-open-topic";
export type HelpOpenTopicDetail = { screen: string; topicId: string };
export function openHelpTopic(detail: HelpOpenTopicDetail) {
  window.dispatchEvent(new CustomEvent<HelpOpenTopicDetail>(HELP_OPEN_TOPIC_EVENT, { detail }));
}
