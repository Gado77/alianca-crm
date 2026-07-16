import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Lead, LeadStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const pipelineStates: LeadStatus[] = [
  "Novo Lead",
  "Aguardando Simulação",
  "Simulação Realizada",
  "Aguardando Cliente",
  "Aprovado",
  "Documentação",
  "Venda Finalizada",
  "Perdido",
];

const dayMs = 24 * 60 * 60 * 1000;

export function daysBetween(date: string, reference = new Date()) {
  const target = new Date(`${date}T12:00:00`);
  const current = new Date(reference);
  current.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - current.getTime()) / dayMs);
}

export function formatCurrency(value?: number) {
  if (!value) return "Não definida";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date?: string) {
  if (!date) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export function calculateOpportunityScore(lead: Lead) {
  if (lead.boughtElsewhere || lead.status === "Perdido") return 0;

  let score = 30;
  if (lead.visitedStore) score += 20;
  if (lead.simulations.length > 0) score += 20;
  if (lead.downPayment && lead.downPayment > 0) score += 15;
  if (lead.respondsWhatsapp) score += 10;
  if (lead.returnedContact) score += 10;
  if (lead.status === "Aprovado" || lead.status === "Documentação") score += 15;
  if (daysBetween(lead.lastContactDate) < -90) score -= 20;

  return Math.max(0, Math.min(100, score));
}

export function dueTone(nextActionDate?: string) {
  if (!nextActionDate) return "neutral";
  const diff = daysBetween(nextActionDate);
  if (diff < 0) return "overdue";
  if (diff <= 2) return "soon";
  return "ok";
}

export function whatsappMessage(lead: Lead) {
  const messages: Record<string, string> = {
    "Score baixo": `Olá, ${lead.fullName.split(" ")[0]}! Tudo bem? Passando para saber se houve alguma mudança na sua situação. Podemos fazer uma nova simulação quando você desejar.`,
    "Sem entrada": `Olá, ${lead.fullName.split(" ")[0]}! Tudo bem? Vim acompanhar sua entrada para a ${lead.model}. Se já estiver mais perto do valor, fazemos uma nova simulação.`,
    "Aguardando salário": `Olá, ${lead.fullName.split(" ")[0]}! Tudo bem? Como combinamos, estou retornando sobre sua simulação da ${lead.model}. Podemos atualizar seus dados hoje?`,
    "Aguardando aposentadoria": `Olá, ${lead.fullName.split(" ")[0]}! Tudo bem? Estou passando para acompanhar sua aposentadoria e ver se já podemos fazer uma nova simulação da ${lead.model}.`,
    "Cliente pediu para voltar": `Olá, ${lead.fullName.split(" ")[0]}! Tudo bem? Você pediu para retornarmos sobre a ${lead.model}. Posso te ajudar agora?`,
  };

  return (
    messages[lead.nextActionReason] ??
    `Olá, ${lead.fullName.split(" ")[0]}! Tudo bem? Aqui é da Aliança Motos Avelloz. Estou acompanhando seu interesse na ${lead.model}. Podemos conversar?`
  );
}

export function whatsappHref(lead: Lead) {
  const cleanPhone = lead.phone.replace(/\D/g, "");
  const phone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(lead))}`;
}

export function suggestedReturnDays(reason: string) {
  const daysByReason: Record<string, number | null> = {
    "Score baixo": 60,
    "Sem entrada": 15,
    "Nome restrito": 60,
    "Aguardando salário": 7,
    "Aguardando aposentadoria": 30,
    "Cliente desistiu": 45,
    "Cliente pediu para voltar": null,
    Outro: 15,
  };
  return daysByReason[reason] ?? 15;
}
