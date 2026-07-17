"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { createSimulationFormAction, updateLeadDetailsFormAction, updateLeadStatusFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { denialReasons, paymentLabels, sourceLabels, statusOptions } from "@/lib/crm";

type Lead = {
  id: string;
  full_name: string;
  cpf: string;
  phone: string;
  city: string;
  email?: string | null;
  birth_date?: string | null;
  license_category?: string | null;
  source?: string | null;
};
type Interest = {
  id?: string | null;
  motorcycle_model?: string | null;
  desired_color?: string | null;
  intended_down_payment?: string | number | null;
  payment_method?: string | null;
  other_payment_method?: string | null;
} | null;
type Bank = { id: string; name: string; active: boolean };

export function LeadEditPanel({ lead, interest }: { lead: Lead; interest: Interest }) {
  const [paymentMethod, setPaymentMethod] = useState(String(interest?.payment_method || "financiamento"));

  return (
    <details className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <h2 className="text-lg font-black text-[#031A4A]">Editar dados do cliente</h2>
        <ChevronDown className="h-5 w-5 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <form action={updateLeadDetailsFormAction} className="mt-4 grid gap-3">
        <input type="hidden" name="lead_id" value={lead.id} />
        <input type="hidden" name="interest_id" value={interest?.id || ""} />
        <Field name="full_name" label="Nome completo" defaultValue={lead.full_name} required />
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="cpf" label="CPF" defaultValue={lead.cpf} required />
          <Field name="phone" label="Telefone" defaultValue={lead.phone} required />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="city" label="Cidade" defaultValue={lead.city} required />
          <Field name="email" label="Email" type="email" defaultValue={lead.email} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="birth_date" label="Data de nascimento" type="date" defaultValue={lead.birth_date} />
          <Select name="license_category" label="CNH" defaultValue={lead.license_category || "nao_possui"}>
            <option value="nao_possui">Não possui CNH</option>
            <option value="a">Categoria A</option>
            <option value="ab">Categoria A e B</option>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="motorcycle_model" label="Modelo de interesse" defaultValue={interest?.motorcycle_model} required />
          <Field name="desired_color" label="Cor (opcional)" defaultValue={interest?.desired_color} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="intended_down_payment" label="Entrada pretendida (opcional)" type="number" defaultValue={interest?.intended_down_payment} />
          <label>
            <span className="mb-2 block text-sm font-black text-slate-700">Forma de pagamento</span>
            <select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400">
              {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {paymentMethod === "outro" && <Field name="other_payment_method" label="Qual forma de pagamento?" defaultValue={interest?.other_payment_method} />}
        <Select name="source" label="Origem" defaultValue={lead.source || "manual"}>
          {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <SubmitButton>Salvar alterações</SubmitButton>
      </form>
    </details>
  );
}

export function LeadStatusForm({ leadId, currentStatus, isAdmin }: { leadId: string; currentStatus: string; isAdmin: boolean }) {
  const [status, setStatus] = useState(currentStatus);
  return (
    <form action={updateLeadStatusFormAction} className="grid gap-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <select name="status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold">
        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {isAdmin && status === "perdido" && <input name="lost_reason" placeholder="Motivo da perda" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />}
      <SubmitButton>Atualizar status</SubmitButton>
    </form>
  );
}

export function SimulationForm({ leadId, banks }: { leadId: string; banks: Bank[] }) {
  const [bankId, setBankId] = useState("");
  const [result, setResult] = useState("pendente");

  return (
    <form action={createSimulationFormAction} className="grid gap-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <select name="bank_id" value={bankId} onChange={(event) => setBankId(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" required>
        <option value="">Selecione o banco</option>
        {banks.filter((bank) => bank.active && bank.name !== "Outro").map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
        <option value="other">Outro banco</option>
      </select>
      {bankId === "other" && <input name="other_bank_name" placeholder="Nome do banco" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />}
      <input type="date" name="simulation_date" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
      <select name="result" value={result} onChange={(event) => setResult(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold">
        <option value="pendente">Pendente</option>
        <option value="aprovado">Aprovado</option>
        <option value="negado">Negado</option>
      </select>
      {result === "negado" && (
        <select name="denial_reason" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold">
          <option value="">Motivo da negativa</option>
          {denialReasons.map((reason) => <option key={reason}>{reason}</option>)}
        </select>
      )}
      <p className="rounded-lg bg-orange-50 p-3 text-xs font-bold text-orange-800">
        Se registrar negativa, o sistema cria lembrete de retorno sozinho: score baixo em 60 dias, cliente inelegivel em 6 meses, sem entrada em 15 dias e salario em 7 dias.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="proposed_down_payment" placeholder="Entrada proposta (opcional)" type="number" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
        <input name="approved_amount" placeholder="Valor aprovado" type="number" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
        <input name="installment_count" placeholder="Parcelas" type="number" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
        <input name="installment_value" placeholder="Valor parcela" type="number" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
      </div>
      <textarea name="bank_response" placeholder="Resposta do banco" rows={3} className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold" />
      <textarea name="notes" placeholder="Observações (opcional)" rows={3} className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold" />
      <SubmitButton>Registrar simulação</SubmitButton>
    </form>
  );
}

function Field({ name, label, type = "text", required = false, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number | null }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue || ""} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400" />
    </label>
  );
}

function Select({ name, label, children, defaultValue }: { name: string; label: string; children: React.ReactNode; defaultValue?: string }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <select name={name} defaultValue={defaultValue} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400">{children}</select>
    </label>
  );
}
