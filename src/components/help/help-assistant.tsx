"use client";

// Assistente de ajuda do portal (porte do assistente da carteira do PORTAL_CLT). Fica montado uma vez
// no AppShell e acompanha a aba ativa:
// - Tour geral do portal no primeiro acesso; depois, o tour de cada tela na primeira visita e de novo
//   quando o layoutVersion da documentação dela muda (só as Novidades, se a tela as listar).
//   O "já viu" fica no servidor (/help/progress), porque o usuário troca de máquina.
// - Botão "Dúvidas?": a pergunta vai para /help/<tela>/ask, que responde só com a documentação fixa.
//   Nenhum dado do cliente é enviado — só o texto digitado.
// As áreas da tela são marcadas com data-help="<target>"; com várias abas montadas ao mesmo tempo,
// vale só o elemento visível.

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MessageCircleQuestion, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabs } from "@/providers/tabs-provider";
import { getApiErrorMessage } from "@/services/api/client";
import { HELP_OPEN_TOPIC_EVENT, PORTAL_HELP_SCREEN, helpScreenForPath, helpService, type HelpDoc, type HelpOpenTopicDetail, type HelpStep, type HelpTopicRef } from "@/services/help.service";
import { useHelpDoc } from "./field-help";

const NOT_FOUND = "Não encontrei isso na ajuda desta tela. Tente perguntar de outro jeito ou escolha um dos temas abaixo.";
const MISSING_NOTE = "Essa área não está visível agora: ela pode depender do tamanho da janela ou de os dados da tela terem carregado.";
const READY_TIMEOUT_MS = 15_000;

// ------------------------------------------------------------------ destaque da área

function findTarget(target: string) {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-help="${target}"]`));
  // getClientRects vazio = elemento (ou um ancestral) com display:none, como as abas ocultas.
  return all.find((el) => el.getClientRects().length > 0) ?? null;
}

async function prepareStep(step: HelpStep) {
  if (!step.target) return false;
  if (findTarget(step.target)) return true;
  if (step.prepare) {
    document.querySelector<HTMLElement>(`[data-help-prepare="${step.prepare}"]`)?.click();
    for (let i = 0; i < 10 && !findTarget(step.target); i++) await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return Boolean(findTarget(step.target));
}

function useTargetRect(target: string | null, active: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!active || !target) return;
    findTarget(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
    // A área pode mudar de lugar (rolagem, dados carregando): acompanha a cada quadro.
    let frame = 0;
    const tick = () => {
      const current = findTarget(target);
      setRect(current ? current.getBoundingClientRect() : null);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);
  return active && target ? rect : null;
}

function Spotlight({ rect, onClose }: { rect: DOMRect | null; onClose: () => void }) {
  if (!rect) return null;
  const pad = 6;
  return <>
    <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden />
    <div aria-hidden className="pointer-events-none fixed z-[60] rounded-xl ring-4 ring-cyan-500 transition-all duration-300" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)" }} />
  </>;
}

// Passos de uma explicação, com a área do passo atual destacada.
function useGuide() {
  const [title, setTitle] = useState<string | null>(null);
  const [steps, setSteps] = useState<HelpStep[]>([]);
  const [index, setIndex] = useState(0);
  const [showing, setShowing] = useState(false);
  const [missing, setMissing] = useState(false);
  const step = steps[index] ?? null;

  const goTo = useCallback(async (list: HelpStep[], i: number) => {
    setIndex(i);
    const current = list[i];
    if (!current) { setShowing(false); return; }
    const ok = await prepareStep(current);
    setMissing(!ok && Boolean(current.target));
    setShowing(ok);
  }, []);
  const start = useCallback((nextTitle: string, list: HelpStep[]) => { setTitle(nextTitle); setSteps(list); void goTo(list, 0); }, [goTo]);
  const stop = useCallback(() => { setTitle(null); setSteps([]); setShowing(false); setMissing(false); }, []);
  const hide = useCallback(() => setShowing(false), []);
  const rect = useTargetRect(step?.target ?? null, showing);
  return { title, steps, index, step, showing, missing, rect, start, stop, goTo, hide };
}
type Guide = ReturnType<typeof useGuide>;

function StepNav({ g, onFinish }: { g: Guide; onFinish?: () => void }) {
  const total = g.steps.length;
  if (total < 2 && !onFinish) return null;
  const last = g.index === total - 1;
  return <div className="flex items-center justify-between gap-2 pt-1">
    <Button type="button" variant="ghost" size="sm" disabled={g.index === 0} onClick={() => g.goTo(g.steps, g.index - 1)}><ChevronLeft size={16} /> Anterior</Button>
    {total > 1 && <span className="text-xs text-slate-500">{g.index + 1} de {total}</span>}
    {last && onFinish
      ? <Button type="button" size="sm" className="bg-[#394a78] hover:bg-[#2d3b61]" onClick={onFinish}>Entendi</Button>
      : <Button type="button" variant="ghost" size="sm" disabled={last} onClick={() => g.goTo(g.steps, g.index + 1)}>Próximo <ChevronRight size={16} /></Button>}
  </div>;
}

function TourPopover({ g, onClose }: { g: Guide; onClose: () => void }) {
  const r = g.rect;
  if (!g.step || (!g.showing && !g.missing)) return null;
  const width = Math.min(340, window.innerWidth - 24);
  const style = r && g.showing
    ? { width, left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), ...(window.innerHeight - r.bottom > 220 ? { top: r.bottom + 16 } : { bottom: window.innerHeight - r.top + 16 }) }
    : { width, left: "50%", top: "40%", transform: "translateX(-50%)" };
  return <div role="dialog" aria-label={g.title ?? "Tour"} className="fixed z-[70] space-y-2 rounded-2xl bg-white p-4 text-sm shadow-2xl" style={style}>
    <div className="flex items-start justify-between gap-2">
      <p className="font-semibold text-slate-950">{g.title}</p>
      <button type="button" aria-label="Fechar o tour" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
    </div>
    <p className="text-slate-700">{g.step.text}</p>
    {g.missing && <p className="text-xs text-amber-700">{MISSING_NOTE}</p>}
    <StepNav g={g} onFinish={onClose} />
  </div>;
}

// ------------------------------------------------------------------ componente

type Msg =
  | { from: "user"; text: string }
  | { from: "bot"; text?: string; screen?: string; topic?: HelpTopicRef; steps?: HelpStep[]; related?: HelpTopicRef[] };

type PendingTour = { screen: string; layoutVersion: string; title: string; steps: HelpStep[] };

function tourFor(doc: HelpDoc, seenVersion: string | undefined): PendingTour | null {
  if (seenVersion === doc.layoutVersion) return null;
  // Já viu uma versão anterior e a tela lista o que mudou: mostra só as Novidades.
  if (seenVersion && doc.whatsNew.length) return { screen: doc.screen, layoutVersion: doc.layoutVersion, title: `Novidades: ${doc.title}`, steps: doc.whatsNew };
  const topic = doc.topics.find((item) => item.id === doc.tourTopicId);
  return topic ? { screen: doc.screen, layoutVersion: doc.layoutVersion, title: topic.title, steps: topic.steps } : null;
}

export function HelpAssistant() {
  const { tabs, activeKey } = useTabs();
  const queryClient = useQueryClient();
  const activePath = tabs.find((tab) => tab.key === activeKey)?.path ?? "";
  const docs = useQuery({ queryKey: ["help-docs"], queryFn: helpService.list, staleTime: Infinity, retry: 1 });
  const screen = helpScreenForPath(activePath, docs.data ?? []);
  const portalDoc = useHelpDoc(PORTAL_HELP_SCREEN);
  const screenDoc = useHelpDoc(screen);
  const progress = useQuery({ queryKey: ["help-progress"], queryFn: helpService.progress, staleTime: Infinity, retry: 1 });
  const doc = screenDoc.data ?? portalDoc.data ?? null;

  const tour = useGuide();
  const answer = useGuide();
  const [tourOn, setTourOn] = useState<PendingTour | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  // Telas cujo tour já abriu nesta sessão: não insiste de novo se a gravação do progresso falhar.
  const autoStarted = useRef(new Set<string>());

  const docFor = useCallback((name: string | undefined) => (name === screenDoc.data?.screen ? screenDoc.data : name === PORTAL_HELP_SCREEN ? portalDoc.data : doc) ?? null, [screenDoc.data, portalDoc.data, doc]);

  const { start: tourStart, stop: tourStop } = tour;
  const { start: answerStart, stop: answerStop } = answer;

  const runTour = useCallback((pending: PendingTour) => {
    setOpen(false);
    answerStop();
    setTourOn(pending);
    tourStart(pending.title, pending.steps);
  }, [tourStart, answerStop]);

  const closeTour = useCallback(() => {
    const finished = tourOn;
    setTourOn(null);
    tourStop();
    if (!finished) return;
    autoStarted.current.add(finished.screen);
    queryClient.setQueryData<Record<string, string>>(["help-progress"], (current) => ({ ...(current ?? {}), [finished.screen]: finished.layoutVersion }));
    void helpService.markSeen(finished.screen, finished.layoutVersion).catch(() => undefined);
  }, [tourOn, tourStop, queryClient]);

  // Tour automático: primeiro o geral do portal, depois o da tela aberta — quando a primeira área
  // do tour aparecer (a tela pode estar carregando dados).
  useEffect(() => {
    if (tourOn || open || progress.isPending) return;
    const seen = progress.data ?? {};
    const candidates = [portalDoc.data, screen !== PORTAL_HELP_SCREEN ? screenDoc.data : undefined];
    const pending = candidates.map((item) => item && !autoStarted.current.has(item.screen) ? tourFor(item, seen[item.screen]) : null).find(Boolean);
    if (!pending) return;
    const readyTarget = pending.steps.find((step) => step.target)?.target;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (readyTarget && !findTarget(readyTarget)) {
        if (Date.now() - startedAt > READY_TIMEOUT_MS) window.clearInterval(timer);
        return;
      }
      window.clearInterval(timer);
      autoStarted.current.add(pending.screen);
      runTour(pending);
    }, 150);
    return () => window.clearInterval(timer);
  }, [tourOn, open, progress.isPending, progress.data, portalDoc.data, screenDoc.data, screen, runTour]);

  // Trocou de aba no meio do tour de uma tela: as áreas dela sumiram, então encerra sem marcar como visto.
  useEffect(() => {
    if (tourOn && tourOn.screen !== PORTAL_HELP_SCREEN && tourOn.screen !== screen) {
      autoStarted.current.delete(tourOn.screen);
      setTourOn(null);
      tourStop();
    }
  }, [screen, tourOn, tourStop]);

  // A conversa é da tela: trocou de tela, começa de novo.
  useEffect(() => { setMsgs([]); answerStop(); }, [screen, answerStop]);

  // Chaves obrigatórias: scrollIntoView pode devolver uma Promise, e o React a trataria como limpeza.
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, answer.index, busy]);

  const showTopic = useCallback((topicScreen: string, topic: HelpTopicRef, steps: HelpStep[], related: HelpTopicRef[] = []) => {
    setMsgs((current) => [...current, { from: "bot", screen: topicScreen, topic, steps, related }]);
    answerStart(topic.title, steps);
  }, [answerStart]);

  const openTopic = useCallback((topicScreen: string | undefined, topicRef: HelpTopicRef) => {
    const source = docFor(topicScreen);
    const topic = source?.topics.find((item) => item.id === topicRef.id);
    if (!source || !topic) return;
    setMsgs((current) => [...current, { from: "user", text: topic.title }]);
    showTopic(source.screen, topic, topic.steps);
  }, [docFor, showTopic]);

  // "Saiba mais" de um <FieldHelp>.
  useEffect(() => {
    const onOpenTopic = (event: Event) => {
      const { screen: topicScreen, topicId } = (event as CustomEvent<HelpOpenTopicDetail>).detail;
      const source = docFor(topicScreen);
      const topic = source?.topics.find((item) => item.id === topicId);
      if (!topic) return;
      if (tourOn) closeTour();
      setOpen(true);
      openTopic(topicScreen, topic);
    };
    window.addEventListener(HELP_OPEN_TOPIC_EVENT, onOpenTopic);
    return () => window.removeEventListener(HELP_OPEN_TOPIC_EVENT, onOpenTopic);
  }, [docFor, openTopic, tourOn, closeTour]);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy || !doc) return;
    setQuestion("");
    setMsgs((current) => [...current, { from: "user", text }]);
    setBusy(true);
    answerStop();
    try {
      const data = await helpService.ask(doc.screen, text);
      if (data.found) showTopic(data.screen, data.topic, data.steps, data.related);
      else setMsgs((current) => [...current, { from: "bot", text: NOT_FOUND, related: data.related }]);
    } catch (error) {
      setMsgs((current) => [...current, { from: "bot", text: getApiErrorMessage(error) || "Não consegui responder agora. Tente de novo em instantes." }]);
    } finally {
      setBusy(false);
    }
  };

  const startScreenTour = () => {
    if (!doc) return;
    const pending = tourFor(doc, undefined);
    if (pending) runTour(pending);
  };

  if (!doc) return null;
  const suggestions = [...doc.topics.filter((topic) => topic.id !== doc.tourTopicId).slice(0, 4).map((topic) => ({ screen: doc.screen, topic })),
    ...(doc.screen !== PORTAL_HELP_SCREEN && portalDoc.data ? [{ screen: PORTAL_HELP_SCREEN, topic: portalDoc.data.topics.find((topic) => topic.id === portalDoc.data!.tourTopicId)! }].filter((item) => item.topic) : [])];
  const lastBot = msgs.length - 1;

  return <>
    {tourOn && <Spotlight rect={tour.rect} onClose={closeTour} />}
    {tourOn && <TourPopover g={tour} onClose={closeTour} />}
    {!tourOn && <Spotlight rect={answer.rect} onClose={answer.hide} />}

    {!open && (
      <button type="button" data-help="assistente" onClick={() => { if (tourOn) closeTour(); setOpen(true); }} className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#394a78] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#2d3b61]">
        <MessageCircleQuestion size={20} /> Dúvidas?
      </button>
    )}

    {open && (
      <div data-help="assistente" role="dialog" aria-label="Ajuda" className="fixed bottom-5 right-3 z-50 flex max-h-[75vh] w-[min(380px,calc(100vw-24px))] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div><p className="font-semibold text-slate-950">Como usar esta tela</p><p className="text-xs text-slate-500">{doc.title}</p></div>
          <button type="button" aria-label="Fechar a ajuda" onClick={() => { setOpen(false); answer.stop(); }} className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
          <div className="max-w-[90%] space-y-2 rounded-2xl bg-slate-100 px-3 py-2 text-slate-800">
            <p>Pergunte como usar esta tela: eu explico e mostro onde fica. Eu não consulto os dados do cliente.</p>
            <button type="button" onClick={startScreenTour} className="text-xs font-semibold text-cyan-700 hover:underline">Ver o tour desta tela</button>
          </div>
          {msgs.map((msg, i) => {
            if (msg.from === "user") return <p key={i} className="ml-auto max-w-[85%] rounded-2xl bg-[#394a78] px-3 py-2 text-white">{msg.text}</p>;
            const live = i === lastBot && msg.topic && answer.title === msg.topic.title;
            const source = docFor(msg.screen);
            return <div key={i} className="max-w-[90%] space-y-2 rounded-2xl bg-slate-100 px-3 py-2 text-slate-800">
              {msg.topic && msg.steps ? <>
                <p className="font-semibold">{msg.topic.title}</p>
                {live ? <>
                  <p>{answer.step?.text}</p>
                  {answer.missing && <p className="text-xs text-amber-700">{MISSING_NOTE}</p>}
                  <StepNav g={answer} />
                  {!answer.showing && answer.step?.target && !answer.missing && <button type="button" className="text-xs font-semibold text-cyan-700" onClick={() => answer.goTo(answer.steps, answer.index)}>Mostrar na tela de novo</button>}
                </> : msg.steps.map((step, j) => <p key={j}>{step.text}</p>)}
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Fonte: {source?.title ?? doc.title} › {msg.topic.title}</p>
              </> : <p>{msg.text}</p>}
              {msg.related && msg.related.length > 0 && <div className="flex flex-wrap gap-1 pt-1">
                {msg.related.map((topic) => <button key={topic.id} type="button" onClick={() => openTopic(msg.screen ?? doc.screen, topic)} className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs">{topic.title}</button>)}
              </div>}
            </div>;
          })}
          {msgs.length === 0 && <div className="flex flex-wrap gap-1">
            {suggestions.map(({ screen: topicScreen, topic }) => <button key={`${topicScreen}:${topic.id}`} type="button" onClick={() => openTopic(topicScreen, topic)} className="rounded-full border border-slate-300 px-2 py-1 text-xs hover:border-slate-500">{topic.title}</button>)}
          </div>}
          {busy && <p className="text-xs text-slate-400">Procurando na ajuda…</p>}
          <div ref={endRef} />
        </div>
        <form onSubmit={ask} className="flex gap-2 border-t border-slate-100 p-3">
          <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} placeholder="Digite sua dúvida" aria-label="Sua dúvida" autoFocus className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600" />
          <Button type="submit" aria-label="Perguntar" disabled={busy} className="bg-[#394a78] hover:bg-[#2d3b61]"><Send size={16} /></Button>
        </form>
      </div>
    )}
  </>;
}
