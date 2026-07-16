"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HomologationItem } from "@/lib/homologation";

type ChecklistStatus = "nao_testado" | "aprovado" | "reprovado";
type ChecklistState = Record<string, { status: ChecklistStatus; note: string }>;

const storageKey = "alianca-homologacao-checklist-v1";
const statuses: Array<{ value: ChecklistStatus; label: string }> = [
  { value: "nao_testado", label: "Não testado" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
];

export function HomologationChecklist({ items }: { items: HomologationItem[] }) {
  const [state, setState] = useState<ChecklistState>(() => {
    if (typeof window === "undefined") return {};
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return {};
    try {
      return JSON.parse(saved) as ChecklistState;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const grouped = useMemo(() => {
    return items.reduce<Record<string, HomologationItem[]>>((acc, item) => {
      acc[item.group] = acc[item.group] || [];
      acc[item.group].push(item);
      return acc;
    }, {});
  }, [items]);

  const totals = items.reduce(
    (acc, item) => {
      const status = state[item.id]?.status || "nao_testado";
      acc[status] += 1;
      return acc;
    },
    { nao_testado: 0, aprovado: 0, reprovado: 0 }
  );

  function updateItem(id: string, patch: Partial<{ status: ChecklistStatus; note: string }>) {
    setState((current) => ({
      ...current,
      [id]: { status: current[id]?.status || "nao_testado", note: current[id]?.note || "", ...patch },
    }));
  }

  function clearChecklist() {
    setState({});
    window.localStorage.removeItem(storageKey);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Counter label="Não testados" value={totals.nao_testado} />
        <Counter label="Aprovados" value={totals.aprovado} />
        <Counter label="Reprovados" value={totals.reprovado} />
      </section>

      <button type="button" onClick={clearChecklist} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
        Limpar checklist
      </button>

      {Object.entries(grouped).map(([group, groupItems]) => (
        <section key={group} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-[#031A4A]">{group}</h2>
          <div className="mt-4 space-y-3">
            {groupItems.map((item) => {
              const value = state[item.id] || { status: "nao_testado", note: "" };
              return (
                <article key={item.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1fr_160px_1.2fr_90px] lg:items-center">
                  <p className="text-sm font-bold text-slate-700">{item.description}</p>
                  <select value={value.status} onChange={(event) => updateItem(item.id, { status: event.target.value as ChecklistStatus })} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold">
                    {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  <input value={value.note} onChange={(event) => updateItem(item.id, { note: event.target.value })} placeholder="Observação" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold" />
                  <Link href={item.href} className="flex min-h-11 items-center justify-center rounded-lg bg-[#031A4A] px-3 text-sm font-black text-white">
                    Abrir
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#031A4A]">{value}</p>
    </article>
  );
}
