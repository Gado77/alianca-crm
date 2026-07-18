"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { createLeadFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { paymentLabels, sourceLabels } from "@/lib/crm";
import type { ProfileRow } from "@/lib/data";

export function LeadCreatePanel({ profile, profiles, defaultOpen = false }: { profile?: ProfileRow | null; profiles: ProfileRow[]; defaultOpen?: boolean }) {
  const [paymentMethod, setPaymentMethod] = useState("financiamento");

  return (
    <details open={defaultOpen} className="group rounded-xl bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-black text-[#031A4A]">Cadastrar cliente</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Abra somente quando for cadastrar um cliente novo.</p>
        </div>
        <ChevronDown className="h-5 w-5 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <form action={createLeadFormAction} className="grid gap-3 border-t border-slate-100 p-4">
        <Field name="full_name" label="Nome completo" required />
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="cpf" label="CPF" required />
          <Field name="phone" label="Telefone" required />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="city" label="Cidade" required />
          <Field name="email" label="Email" type="email" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="birth_date" label="Data de nascimento" type="date" />
          <Select name="license_category" label="CNH">
            <option value="nao_possui">Não possui CNH</option>
            <option value="a">Categoria A</option>
            <option value="ab">Categoria A e B</option>
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="motorcycle_model" label="Modelo de interesse" required />
          <Field name="desired_color" label="Cor (opcional)" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="intended_down_payment" label="Entrada pretendida (opcional)" type="number" />
          <label>
            <span className="mb-2 block text-sm font-black text-slate-700">Forma de pagamento</span>
            <select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400">
              {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {paymentMethod === "outro" && <Field name="other_payment_method" label="Qual forma de pagamento?" />}
        <Select name="source" label="Origem">
          {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        {profile?.role === "admin" && profiles.length > 1 && (
          <Select name="assigned_user_id" label="Responsável">
            <option value="">Eu mesmo / sem responsável</option>
            {profiles.filter((item) => item.active).map((seller) => <option key={seller.id} value={seller.id}>{seller.full_name}</option>)}
          </Select>
        )}
        <label>
          <span className="mb-2 block text-sm font-black text-slate-700">Observações</span>
          <textarea name="notes" rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base font-semibold outline-none focus:border-orange-400" />
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-lg bg-orange-50 px-3 text-sm font-bold text-orange-800">
          <input type="checkbox" name="duplicate_confirmed" value="true" />
          Confirmo continuar se houver possível duplicidade
        </label>
        <SubmitButton>Cadastrar cliente</SubmitButton>
      </form>
    </details>
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

function Select({ name, label, children }: { name: string; label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <select name={name} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400">{children}</select>
    </label>
  );
}
