import type { LeadStatusDb } from "@/lib/crm";

export type AssistantPriority = "baixa" | "media" | "alta" | "urgente";

export type AssistantPlanAction =
  | {
      type: "note";
      title: string;
      content: string;
    }
  | {
      type: "follow_up";
      title: string;
      reason: string;
      due_at: string;
      priority: AssistantPriority;
    }
  | {
      type: "status";
      title: string;
      status: LeadStatusDb;
      lost_reason?: string;
    };

export type AssistantLeadOption = {
  id: string;
  full_name: string;
  city?: string | null;
  status?: string | null;
  phone?: string | null;
};

export type AssistantPlan = {
  ok: boolean;
  message: string;
  lead?: AssistantLeadOption | null;
  candidates?: AssistantLeadOption[];
  summary?: string;
  actions?: AssistantPlanAction[];
  whatsapp_suggestion?: string;
  needs_confirmation?: boolean;
};

export const assistantPriorities: AssistantPriority[] = ["baixa", "media", "alta", "urgente"];

export const assistantStatuses: LeadStatusDb[] = [
  "novo_lead",
  "aguardando_simulacao",
  "simulacao_realizada",
  "aguardando_cliente",
  "aprovado",
  "documentacao",
  "venda_finalizada",
  "perdido",
];
