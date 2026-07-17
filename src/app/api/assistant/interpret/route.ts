import { NextResponse } from "next/server";
import { assistantPriorities, assistantStatuses, type AssistantPlan, type AssistantPlanAction } from "@/lib/assistant";
import { createSupabaseServerClient, getCurrentSessionProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type GroqJson = {
  lead_name?: string;
  summary?: string;
  actions?: AssistantPlanAction[];
  whatsapp_suggestion?: string;
};

export async function POST(request: Request) {
  const { user, profile } = await getCurrentSessionProfile();
  if (!user || !profile?.active) {
    return NextResponse.json({ ok: false, message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const { text } = await request.json().catch(() => ({ text: "" }));
  const command = typeof text === "string" ? text.trim() : "";
  if (command.length < 4) {
    return NextResponse.json({ ok: false, message: "Digite ou fale uma instrução para o assistente." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id,full_name,city,status,phone,assigned_user_id,active")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) return NextResponse.json({ ok: false, message: "Não consegui carregar os clientes." }, { status: 400 });

  const leadOptions = (leads || []).map((lead) => ({
    id: lead.id,
    full_name: lead.full_name,
    city: lead.city,
    status: lead.status,
    phone: lead.phone,
  }));

  const parsed = await interpretWithGroq(command, leadOptions);
  if (!parsed.ok) return NextResponse.json(parsed, { status: 400 });

  const leadName = parsed.lead_name || "";
  const candidates = findLeadCandidates(leadName || command, leadOptions);
  const selected = candidates.length === 1 ? candidates[0] : null;

  const plan: AssistantPlan = {
    ok: true,
    message: selected
      ? "Revise o plano antes de salvar."
      : candidates.length > 1
        ? "Encontrei mais de um cliente possível. Abra o cliente correto e tente com nome completo."
        : "Não encontrei o cliente com segurança. Tente falar nome e sobrenome.",
    lead: selected,
    candidates,
    summary: parsed.summary || command,
    actions: selected ? sanitizeActions(parsed.actions || []) : [],
    whatsapp_suggestion: parsed.whatsapp_suggestion || "",
    needs_confirmation: Boolean(selected),
  };

  return NextResponse.json(plan);
}

async function interpretWithGroq(command: string, leads: Array<{ id: string; full_name: string; city?: string | null; status?: string | null }>): Promise<GroqJson & { ok: boolean; message: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_TEXT_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  if (!apiKey) return { ok: false, message: "Configure GROQ_API_KEY no servidor." };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_completion_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Você é o Assistente do CRM da Aliança Motos.",
            "Interprete comandos curtos de vendedor e transforme em ações seguras.",
            "Nunca invente cliente. Use lead_name com o nome dito pelo usuário.",
            "Ações permitidas: note, follow_up, status.",
            "Status permitidos: novo_lead, aguardando_simulacao, simulacao_realizada, aguardando_cliente, aprovado, documentacao, venda_finalizada, perdido.",
            "Prioridades permitidas: baixa, media, alta, urgente.",
            "Regras comerciais: falar com marido/esposa => retorno amanhã, prioridade alta. Parcela/preço alto => retorno em 2 dias, alta. Sem entrada => 15 dias, media. Score baixo => 60 dias, media. Inelegível/nome restrito => 6 meses, baixa. Aprovado => status aprovado e retorno em 1 dia se houver objeção.",
            "due_at deve ser ISO string. Use datas futuras a partir de hoje.",
            "Retorne JSON com: lead_name, summary, actions, whatsapp_suggestion.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            today: new Date().toISOString(),
            command,
            available_leads: leads.map((lead) => ({ name: lead.full_name, city: lead.city, status: lead.status })),
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("assistant.interpret", response.status, detail.slice(0, 300));
    return { ok: false, message: response.status === 429 ? "A Groq atingiu limite agora. Tente novamente em instantes." : "Não consegui interpretar com IA agora." };
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return { ok: false, message: "A IA não retornou um plano válido." };

  try {
    const parsed = JSON.parse(content) as GroqJson;
    return { ok: true, message: "Plano interpretado.", ...parsed };
  } catch {
    return { ok: false, message: "A IA retornou uma resposta inválida." };
  }
}

function findLeadCandidates(query: string, leads: Array<{ id: string; full_name: string; city?: string | null; status?: string | null; phone?: string | null }>) {
  const normalized = normalizeText(query);
  const tokens = normalized.split(" ").filter((token) => token.length >= 3);
  if (!tokens.length) return [];

  return leads
    .map((lead) => {
      const name = normalizeText(lead.full_name);
      const score = tokens.reduce((total, token) => total + (name.includes(token) ? 1 : 0), 0);
      return { lead, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.lead.full_name.localeCompare(b.lead.full_name))
    .slice(0, 4)
    .map((item) => item.lead);
}

function sanitizeActions(actions: AssistantPlanAction[]) {
  return actions
    .filter((action) => action && ["note", "follow_up", "status"].includes(action.type))
    .map((action) => {
      if (action.type === "follow_up") {
        return {
          ...action,
          priority: assistantPriorities.includes(action.priority) ? action.priority : "media",
          due_at: validFutureDate(action.due_at),
        };
      }
      if (action.type === "status") {
        return {
          ...action,
          status: assistantStatuses.includes(action.status) ? action.status : "aguardando_cliente",
        };
      }
      return action;
    })
    .slice(0, 4);
}

function validFutureDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow.toISOString();
  }
  return date.toISOString();
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
