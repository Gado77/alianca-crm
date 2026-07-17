"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLeadStatusFormAction } from "@/app/actions";
import { pipelineStatuses, statusLabels } from "@/lib/crm";
import { cn } from "@/lib/utils";

type PipelineLead = {
  id: string;
  full_name: string;
  city: string | null;
  status: string;
  model: string | null;
  seller: string | null;
};

export function PipelineBoard({ leads }: { leads: PipelineLead[] }) {
  const [items, setItems] = useState(leads);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function persistStatus(leadId: string, status: string) {
    const lostReason = status === "perdido" ? window.prompt("Motivo da perda")?.trim() : "";
    if (status === "perdido" && !lostReason) return;
    setItems((current) => current.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)));
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lead_id", leadId);
      formData.set("status", status);
      if (lostReason) formData.set("lost_reason", lostReason);
      await updateLeadStatusFormAction(formData);
      setDraggingId(null);
    });
  }

  return (
    <section className="flex gap-3 overflow-x-auto pb-3">
      {pipelineStatuses.map((status) => {
        const column = items.filter((lead) => lead.status === status);
        return (
          <div
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const leadId = event.dataTransfer.getData("text/plain");
              if (leadId) persistStatus(leadId, status);
            }}
            className={cn("min-w-[292px] rounded-lg border border-slate-200 bg-slate-100 p-3", pending && "opacity-80")}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">{statusLabels[status]}</h2>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-500">{column.length}</span>
            </div>
            <div className="space-y-3">
              {column.map((lead) => (
                <article
                  key={lead.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggingId(lead.id);
                    event.dataTransfer.setData("text/plain", lead.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  className={cn("rounded-lg border border-slate-200 bg-white p-3 shadow-sm", draggingId === lead.id && "opacity-60")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-black text-slate-950">{lead.full_name}</Link>
                      <p className="mt-1 text-xs font-bold text-slate-500">{lead.model || "Sem modelo"} · {lead.city || "-"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{lead.seller || "Sem responsável"}</p>
                    </div>
                  </div>
                  <form action={updateLeadStatusFormAction} className="mt-3 grid gap-2">
                    <input type="hidden" name="lead_id" value={lead.id} />
                    <select
                      name="status"
                      value={lead.status}
                      onChange={(event) => persistStatus(lead.id, event.target.value)}
                      className="min-h-10 rounded-lg border border-slate-200 px-2 text-xs font-bold"
                    >
                      {pipelineStatuses.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
                    </select>
                    <button className="flex min-h-10 w-full items-center justify-center rounded-lg bg-[#031A4A] text-xs font-black text-white">
                      Salvar status
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
