"use client";

import { useRef, useState, useTransition } from "react";
import { Bot, CheckCircle2, Loader2, Mic, Send, Sparkles, X } from "lucide-react";
import { executeAssistantPlanAction, type ActionState } from "@/app/actions";
import type { AssistantPlan } from "@/lib/assistant";

const initialActionState: ActionState = { ok: false, message: "" };

export function CrmAssistant() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<AssistantPlan | null>(null);
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [pending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  async function interpret() {
    const command = text.trim();
    if (!command) {
      setMessage("Digite ou fale o que aconteceu com o cliente.");
      return;
    }

    setInterpreting(true);
    setMessage("");
    setPlan(null);
    try {
      const response = await fetch("/api/assistant/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: command }),
      });
      const payload = (await response.json().catch(() => null)) as AssistantPlan | null;
      if (!payload) {
        setMessage("Não consegui ler a resposta do assistente.");
        return;
      }
      setPlan(payload);
      setMessage(payload.message);
    } catch (error) {
      console.error("assistant.interpret", error instanceof Error ? error.message : "unknown");
      setMessage("Falha de conexão com o assistente.");
    } finally {
      setInterpreting(false);
    }
  }

  function confirmPlan() {
    if (!plan?.lead || !plan.actions?.length) return;
    const formData = new FormData();
    formData.set("plan", JSON.stringify(plan));
    startTransition(async () => {
      const result = await executeAssistantPlanAction(initialActionState, formData);
      setMessage(result.message);
      if (result.ok) {
        setPlan(null);
        setText("");
      }
    });
  }

  function startVoice() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setMessage("Seu navegador não liberou reconhecimento de voz. Digite a instrução.");
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onerror = () => {
      setListening(false);
      setMessage("Não consegui ouvir agora. Tente de novo ou digite.");
    };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) setText((current) => `${current ? `${current} ` : ""}${transcript}`.trim());
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(150px+env(safe-area-inset-bottom))] left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#031A4A] text-white shadow-lg lg:bottom-6 lg:left-auto lg:right-6"
      >
        <Bot className="h-6 w-6" />
        <span className="sr-only">Abrir Assistente do CRM</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 p-3 lg:flex lg:items-end lg:justify-end" onClick={() => setOpen(false)}>
          <section
            className="ml-auto flex max-h-[calc(100vh-24px)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-600">
                  <Sparkles className="h-4 w-4" />
                  Assistente do CRM
                </p>
                <h2 className="mt-1 text-lg font-black text-[#031A4A]">Diga o que aconteceu com o cliente</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <label>
                <span className="mb-2 block text-sm font-black text-slate-700">Comando</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={4}
                  placeholder="Ex.: Raquel teve simulação aprovada, deu 7 mil de entrada e disse que vai falar com o marido."
                  className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-orange-400"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <button
                  type="button"
                  onClick={startVoice}
                  disabled={listening || interpreting || pending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:opacity-60"
                >
                  <Mic className="h-4 w-4" />
                  {listening ? "Ouvindo..." : "Microfone"}
                </button>
                <button
                  type="button"
                  onClick={interpret}
                  disabled={interpreting || pending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#E84A2A] px-4 text-sm font-black text-white disabled:opacity-60"
                >
                  {interpreting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Interpretar
                </button>
              </div>

              {message && (
                <p className={`rounded-lg px-3 py-2 text-sm font-bold ${plan?.ok || message.includes("salvou") ? "bg-orange-50 text-orange-800" : "bg-red-50 text-red-700"}`}>
                  {message}
                </p>
              )}

              {plan && <PlanPreview plan={plan} />}
            </div>

            <footer className="border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={confirmPlan}
                disabled={!plan?.lead || !plan.actions?.length || pending}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#031A4A] text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar e salvar
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function PlanPreview({ plan }: { plan: AssistantPlan }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Cliente identificado</p>
        <p className="mt-1 text-sm font-black text-slate-900">{plan.lead?.full_name || "Não identificado com segurança"}</p>
        {plan.candidates && plan.candidates.length > 1 && (
          <p className="mt-1 text-xs font-bold text-slate-500">
            Possíveis: {plan.candidates.map((candidate) => candidate.full_name).join(", ")}
          </p>
        )}
      </div>

      {plan.summary && (
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Resumo</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{plan.summary}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Ações sugeridas</p>
        {!plan.actions?.length && <p className="text-sm font-semibold text-slate-500">Nenhuma ação segura para salvar.</p>}
        {plan.actions?.map((action, index) => (
          <article key={`${action.type}-${index}`} className="rounded-lg bg-white p-3 text-sm shadow-sm">
            <p className="font-black text-[#031A4A]">{action.title || action.type}</p>
            {action.type === "note" && <p className="mt-1 font-semibold text-slate-600">{action.content}</p>}
            {action.type === "follow_up" && (
              <p className="mt-1 font-semibold text-slate-600">
                {action.reason} · {new Date(action.due_at).toLocaleString("pt-BR")} · {action.priority}
              </p>
            )}
            {action.type === "status" && <p className="mt-1 font-semibold text-slate-600">Mudar status para {action.status}</p>}
          </article>
        ))}
      </div>

      {plan.whatsapp_suggestion && (
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-400">Mensagem sugerida</p>
          <p className="mt-1 rounded-lg bg-white p-3 text-sm font-semibold text-slate-700">{plan.whatsapp_suggestion}</p>
        </div>
      )}
    </section>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
};

type SpeechRecognitionEventLike = {
  results?: ArrayLike<ArrayLike<{ transcript: string }>>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}
