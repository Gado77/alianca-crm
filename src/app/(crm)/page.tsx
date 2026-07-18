import Link from "next/link";
import { CalendarClock, Clock3, Plus } from "lucide-react";
import { completeFollowUpFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { PostponeFollowUp } from "@/components/postpone-follow-up";
import { WhatsappButton } from "@/components/whatsapp-button";
import { getLeadCollections } from "@/lib/data";
import { followUpPriorityLabels, formatDateTime, statusLabels, whatsappMessage, whatsappUrl } from "@/lib/crm";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

export default async function TodayPage() {
  const { leads, interests, simulations, followUps, errors } = await getLeadCollections();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  if (errors.length) {
    return <StateCard title="Erro ao carregar dados" description={errors[0]?.message || "Verifique as variáveis de ambiente e RLS."} />;
  }

  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const interestByLead = new Map(interests.map((item) => [item.lead_id, item]));
  const pendingFollowUps = followUps.filter((item) => item.status === "pendente" || item.status === "adiado");
  const overdue = pendingFollowUps.filter((item) => new Date(item.due_at) < todayStart);
  const today = pendingFollowUps.filter((item) => {
    const due = new Date(item.due_at);
    return due >= todayStart && due <= todayEnd;
  });
  const pendingSimulations = simulations.filter((item) => item.result === "pendente");
  const pendingFollowUpLeadIds = new Set(pendingFollowUps.map((item) => item.lead_id));
  const activeOpenLeads = leads.filter((lead) => lead.active && !["venda_finalizada", "perdido", "aguardando_simulacao"].includes(lead.status));
  const staleLeads = activeOpenLeads.filter((lead) => {
    const lastContact = lead.last_contact_at || lead.created_at;
    return !pendingFollowUpLeadIds.has(lead.id) && todayStart.getTime() - new Date(lastContact).getTime() > 7 * 86400000;
  });

  const followUpQueue = pendingFollowUps
    .map((followUp) => {
      const lead = leadById.get(followUp.lead_id);
      const interest = interestByLead.get(followUp.lead_id);
      const due = new Date(followUp.due_at);
      const isOverdue = due < todayStart;
      const isToday = due <= todayEnd;
      return { kind: "follow_up" as const, followUp, lead, interest, due, isOverdue, isToday };
    })
    .filter((item) => item.lead)
    .sort((a, b) => {
      const priority = { urgente: 0, alta: 1, media: 2, baixa: 3 } as Record<string, number>;
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
      const priorityDiff = (priority[a.followUp.priority] ?? 4) - (priority[b.followUp.priority] ?? 4);
      if (priorityDiff !== 0) return priorityDiff;
      return a.due.getTime() - b.due.getTime();
    });

  const simulationQueue = pendingSimulations
    .map((simulation) => ({
      kind: "simulation" as const,
      simulation,
      lead: leadById.get(simulation.lead_id),
      interest: interestByLead.get(simulation.lead_id),
    }))
    .filter((item) => item.lead);

  const staleQueue = staleLeads.map((lead) => ({
    kind: "stale" as const,
    lead,
    interest: interestByLead.get(lead.id),
  }));

  const hasItems = followUpQueue.length > 0 || simulationQueue.length > 0 || staleQueue.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Hoje</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#031A4A] sm:text-3xl">Prioridades de hoje</h1>
        </div>
        <Link href="/leads/novo" className="hidden min-h-11 items-center justify-center gap-2 rounded-lg bg-[#E84A2A] px-4 text-sm font-black text-white sm:inline-flex">
          <Plus className="h-4 w-4" />
          Novo cliente
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric title="Atrasados" value={overdue.length} />
        <Metric title="Hoje" value={today.length} />
        <Metric title="Simulações pendentes" value={pendingSimulations.length} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-black text-[#031A4A]">O que você precisa fazer hoje</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Fila única: atrasados, retornos de hoje, simulações pendentes e clientes sem contato recente.</p>
        </div>

        {!hasItems && (
          <div className="rounded-xl bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">
            Nenhuma prioridade pendente agora.
          </div>
        )}

        {followUpQueue.map(({ followUp, lead, interest, isOverdue }) => {
          if (!lead) return null;
          const message = whatsappMessage({
            full_name: lead.full_name,
            phone: lead.phone,
            status: lead.status,
            reason: followUp.reason,
            model: interest?.motorcycle_model,
          });
          return (
            <article key={followUp.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">{lead.full_name}</h3>
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${isOverdue ? "bg-rose-50 text-rose-700" : "bg-orange-50 text-orange-700"}`}>
                      {isOverdue ? "Retorno atrasado" : "Retorno hoje"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{interest?.motorcycle_model || "Sem modelo"} · {lead.city}</p>
                  <div className="mt-3 grid gap-1 text-sm font-bold text-slate-600">
                    <span>{followUp.reason || statusLabels[lead.status as keyof typeof statusLabels]}</span>
                    <span>{followUpPriorityLabels[followUp.priority] || followUp.priority}</span>
                    <span>{formatDateTime(followUp.due_at)}</span>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[380px]">
                  <WhatsappButton leadId={lead.id} href={whatsappUrl(lead.phone, message)} />
                  <Link href={`/leads/${lead.id}`} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 text-xs font-black">Abrir cliente</Link>
                  <form action={completeFollowUpFormAction}>
                    <input type="hidden" name="id" value={followUp.id} />
                    <input type="hidden" name="completion_notes" value="Concluído pela tela Hoje." />
                    <SubmitButton className="flex min-h-10 w-full items-center justify-center rounded-lg bg-[#031A4A] text-xs font-black text-white">Concluir</SubmitButton>
                  </form>
                  <PostponeFollowUp id={followUp.id} reason={followUp.reason || "Retorno"} />
                </div>
              </div>
            </article>
          );
        })}

        {simulationQueue.map(({ simulation, lead, interest }) => {
          if (!lead) return null;
          const message = whatsappMessage({ full_name: lead.full_name, phone: lead.phone, status: lead.status, reason: "Simulação aguardando resposta", model: interest?.motorcycle_model });
          return (
            <article key={`simulation-${simulation.id}`} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{lead.full_name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{interest?.motorcycle_model || "Sem modelo"} · {lead.city}</p>
                  <p className="mt-3 text-sm font-bold text-slate-600">Simulação aguardando resposta</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[260px]">
                  <WhatsappButton leadId={lead.id} href={whatsappUrl(lead.phone, message)} />
                  <Link href={`/leads/${lead.id}`} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 text-xs font-black">Abrir cliente</Link>
                </div>
              </div>
            </article>
          );
        })}

        {staleQueue.map(({ lead, interest }) => {
          const lastContact = lead.last_contact_at || lead.created_at;
          const days = Math.max(1, Math.floor((todayStart.getTime() - new Date(lastContact).getTime()) / 86400000));
          const message = whatsappMessage({ full_name: lead.full_name, phone: lead.phone, status: lead.status, reason: "Sem contato recente", model: interest?.motorcycle_model });
          return (
            <article key={`stale-${lead.id}`} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{lead.full_name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{interest?.motorcycle_model || "Sem modelo"} · {lead.city}</p>
                  <p className="mt-3 text-sm font-bold text-slate-600">Sem contato há {days} dia(s) e sem retorno marcado</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[260px]">
                  <WhatsappButton leadId={lead.id} href={whatsappUrl(lead.phone, message)} />
                  <Link href={`/leads/${lead.id}`} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 text-xs font-black">Abrir cliente</Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
        {title === "Atrasados" ? <Clock3 className="h-4 w-4 text-orange-600" /> : <CalendarClock className="h-4 w-4 text-orange-600" />}
      </div>
      <p className="mt-2 text-3xl font-black text-[#031A4A]">{value}</p>
    </article>
  );
}

function StateCard({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-xl border border-rose-200 bg-white p-5">
      <h1 className="text-xl font-black text-rose-700">{title}</h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">{description}</p>
    </section>
  );
}
