export type UserRole = "admin" | "vendedor";
export type LeadStatusDb =
  | "novo_lead"
  | "aguardando_simulacao"
  | "simulacao_realizada"
  | "aguardando_cliente"
  | "aprovado"
  | "documentacao"
  | "venda_finalizada"
  | "perdido";

export type SimulationResultDb = "pendente" | "aprovado" | "negado";
export type FollowUpStatusDb = "pendente" | "concluido" | "adiado" | "cancelado";
export type LeadSourceDb =
  | "instagram"
  | "facebook"
  | "loja"
  | "indicacao"
  | "whatsapp"
  | "evento"
  | "site"
  | "google"
  | "manual"
  | "outro";

export const statusLabels: Record<LeadStatusDb, string> = {
  novo_lead: "Novo cliente",
  aguardando_simulacao: "Aguardando Simulação",
  simulacao_realizada: "Simulação Realizada",
  aguardando_cliente: "Aguardando Cliente",
  aprovado: "Aprovado",
  documentacao: "Documentação",
  venda_finalizada: "Venda Finalizada",
  perdido: "Perdido",
};

export const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

export const sourceLabels: Record<LeadSourceDb, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  site: "Site",
  loja: "Loja",
  indicacao: "Indicação",
  evento: "Evento",
  google: "Google",
  manual: "Manual",
  outro: "Outro",
};

export const paymentLabels: Record<string, string> = {
  financiamento: "Financiamento",
  cartao: "Cartão",
  a_vista: "À vista",
  consorcio: "Consórcio",
  outro: "Outro",
};

export const resultLabels: Record<SimulationResultDb, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  negado: "Negado",
};

export const followUpLabels: Record<FollowUpStatusDb, string> = {
  pendente: "Pendente",
  concluido: "Concluído",
  adiado: "Adiado",
  cancelado: "Cancelado",
};

export const followUpPriorityLabels: Record<string, string> = {
  urgente: "Urgente: falar hoje",
  alta: "Alta: resolver em poucos dias",
  media: "Média: acompanhar no prazo",
  baixa: "Baixa: lembrar mais pra frente",
};

export const pipelineStatuses = Object.keys(statusLabels) as LeadStatusDb[];

export const denialReturnDays: Record<string, number | null> = {
  "Score baixo": 60,
  "Cliente inelegível": 180,
  "Sem entrada": 15,
  "Nome restrito": 60,
  "Aguardando salário": 7,
  "Aguardando aposentadoria": 30,
  "Cliente desistiu": 45,
  "Cliente pediu para voltar": null,
  Outro: 15,
};

export const denialReasons = Object.keys(denialReturnDays);

export function onlyDigits(value?: string | null) {
  return (value || "").replace(/\D/g, "");
}

export function maskCpf(value?: string | null) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return "***.***.***-**";
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

export function formatCurrency(value?: number | string | null) {
  const number = Number(value || 0);
  if (!number) return "Não definida";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(number);
}

export function whatsappUrl(phone: string, message: string) {
  const digits = onlyDigits(phone);
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function whatsappMessage(lead: {
  full_name: string;
  phone: string;
  status?: LeadStatusDb | null;
  reason?: string | null;
  model?: string | null;
}) {
  const firstName = lead.full_name.split(" ")[0];
  const model = lead.model || "moto";
  const reason = lead.reason || "";

  if (reason.includes("Score baixo")) {
    return `Olá, ${firstName}! Tudo bem? Passando para saber se houve alguma mudança e se você gostaria de fazer uma nova simulação da sua ${model}.`;
  }
  if (reason.includes("Aguardando salário")) {
    return `Olá, ${firstName}! Você comentou que receberia nesses dias. Quer que a gente faça uma nova simulação para a ${model}?`;
  }
  if (lead.status === "documentacao") {
    return `Olá, ${firstName}! Conseguiu separar a documentação? Assim podemos continuar seu atendimento da ${model}.`;
  }
  return `Olá, ${firstName}! Aqui é da Aliança Motos Avelloz. Passando para dar continuidade ao seu atendimento sobre a ${model}.`;
}

export function calculateServerOpportunityScore(input: {
  status?: LeadStatusDb | null;
  hasSimulation?: boolean;
  downPayment?: number | null;
  lastContactAt?: string | null;
}) {
  if (input.status === "perdido") return 0;
  let score = 30;
  if (input.hasSimulation) score += 20;
  if ((input.downPayment || 0) > 0) score += 15;
  if (input.status === "aprovado" || input.status === "documentacao") score += 15;
  if (input.lastContactAt) {
    const lastContact = new Date(input.lastContactAt).getTime();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastContact > ninetyDays) score -= 20;
  }
  return Math.max(0, Math.min(100, score));
}
