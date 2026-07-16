"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const tabs = ["Resumo", "Simulações", "Histórico", "Mais"] as const;
type Tab = (typeof tabs)[number];

export function LeadTabs({ resumo, simulacoes, historico, mais }: { resumo: React.ReactNode; simulacoes: React.ReactNode; historico: React.ReactNode; mais: React.ReactNode }) {
  const [active, setActive] = useState<Tab>("Resumo");
  const content: Record<Tab, React.ReactNode> = { Resumo: resumo, Simulações: simulacoes, Histórico: historico, Mais: mais };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-4 rounded-xl bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={cn("min-h-11 rounded-lg text-xs font-black sm:text-sm", active === tab ? "bg-[#031A4A] text-white" : "text-slate-500")}
          >
            {tab}
          </button>
        ))}
      </div>
      {content[active]}
    </section>
  );
}
