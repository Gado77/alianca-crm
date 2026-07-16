"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteBankFormAction, saveBankFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";

type Bank = {
  id: string;
  name: string;
  active: boolean;
};

export function BanksManager({ banks, isAdmin }: { banks: Bank[]; isAdmin: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const visibleBanks = banks.filter((bank) => bank.name !== "Outro");

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {visibleBanks.map((bank) => (
        <article key={bank.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black text-slate-950">{bank.name}</p>
              <p className={`mt-2 text-sm font-bold ${bank.active ? "text-emerald-600" : "text-rose-600"}`}>{bank.active ? "Ativo" : "Inativo"}</p>
            </div>
            {isAdmin && (
              <button type="button" onClick={() => setEditingId(editingId === bank.id ? null : bank.id)} className="rounded-lg border border-slate-200 p-2 text-slate-600">
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
          {isAdmin && editingId === bank.id && (
            <div className="mt-4 grid gap-2">
              <form action={saveBankFormAction} className="grid gap-2">
                <input type="hidden" name="id" value={bank.id} />
                <input name="name" defaultValue={bank.name} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
                <select name="active" defaultValue={String(bank.active)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold">
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
                <SubmitButton className="min-h-10 rounded-lg bg-[#031A4A] text-xs font-black text-white">Atualizar</SubmitButton>
              </form>
              <form action={deleteBankFormAction}>
                <input type="hidden" name="id" value={bank.id} />
                <button className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 text-xs font-black text-rose-700">
                  <Trash2 className="h-4 w-4" />
                  Apagar
                </button>
              </form>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
