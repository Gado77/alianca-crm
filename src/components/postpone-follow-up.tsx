"use client";

import { useState } from "react";
import { postponeFollowUpFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";

export function PostponeFollowUp({ id, reason }: { id: string; reason: string }) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <details className="rounded-lg border border-slate-200 p-2">
      <summary className="cursor-pointer text-center text-xs font-black text-slate-700">Adiar</summary>
      <div className="mt-2 grid gap-2">
        <QuickPostpone id={id} reason={reason} label="Amanhã" days={1} />
        <QuickPostpone id={id} reason={reason} label="Em 3 dias" days={3} />
        <QuickPostpone id={id} reason={reason} label="Próxima semana" days={7} />
        <button
          type="button"
          onClick={() => setCustomOpen((value) => !value)}
          className="flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-black"
        >
          Escolher data
        </button>
        {customOpen && (
          <form action={postponeFollowUpFormAction} className="grid gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="reason" value={`${reason || "Retorno"} (adiado)`} />
            <input type="datetime-local" name="due_at" className="min-h-10 rounded-lg border border-slate-200 px-2 text-xs font-bold" required />
            <SubmitButton className="flex min-h-10 w-full items-center justify-center rounded-lg bg-[#031A4A] text-xs font-black text-white">Confirmar data</SubmitButton>
          </form>
        )}
      </div>
    </details>
  );
}

function QuickPostpone({ id, reason, label, days }: { id: string; reason: string; label: string; days: number }) {
  return (
    <form action={postponeFollowUpFormAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="reason" value={`${reason || "Retorno"} (adiado)`} />
      <input type="hidden" name="due_at" value={futureDate(days)} />
      <SubmitButton className="flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-black">{label}</SubmitButton>
    </form>
  );
}

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}
