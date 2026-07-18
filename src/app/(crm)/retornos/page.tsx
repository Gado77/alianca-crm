import Link from "next/link";
import { cancelFollowUpFormAction, completeFollowUpFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { PostponeFollowUp } from "@/components/postpone-follow-up";
import { WhatsappButton } from "@/components/whatsapp-button";
import { getLeadCollections } from "@/lib/data";
import { followUpPriorityLabels, formatDateTime, whatsappMessage, whatsappUrl } from "@/lib/crm";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "atrasados", label: "Atrasados" },
  { value: "hoje", label: "Hoje" },
  { value: "proximos", label: "Próximos" },
  { value: "concluidos", label: "Concluídos" },
];

export default async function ReturnsPage({ searchParams }: { searchParams?: Promise<{ aba?: string }> }) {
  const params = await searchParams;
  const activeTab = params?.aba || "hoje";
  const { leads, interests, followUps } = await getLeadCollections();
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const interestByLead = new Map(interests.map((item) => [item.lead_id, item]));
  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const filtered = followUps.filter((item) => {
    const due = new Date(item.due_at);
    if (activeTab === "atrasados") return item.status === "pendente" && due < now;
    if (activeTab === "hoje") return item.status === "pendente" && due <= todayEnd;
    if (activeTab === "proximos") return (item.status === "pendente" || item.status === "adiado") && due > todayEnd;
    if (activeTab === "concluidos") return item.status === "concluido";
    return true;
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Retornos</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Quem precisa de contato?</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
          Retorno e um lembrete para falar com o cliente no dia certo: WhatsApp, ligacao, documentos ou nova simulacao.
        </p>
      </header>

      <nav className="grid grid-cols-4 rounded-xl bg-white p-1 shadow-sm">
        {tabs.map((tab) => (
          <Link key={tab.value} href={`/retornos?aba=${tab.value}`} className={cn("flex min-h-11 items-center justify-center rounded-lg text-xs font-black sm:text-sm", activeTab === tab.value ? "bg-[#031A4A] text-white" : "text-slate-500")}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-3">
        {filtered.length === 0 && <p className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Nenhum retorno nesta aba.</p>}
        {filtered.map((item) => {
          const lead = leadById.get(item.lead_id);
          const interest = interestByLead.get(item.lead_id);
          const days = Math.ceil((new Date(item.due_at).getTime() - now.getTime()) / 86400000);
          if (!lead) return null;
          return (
            <article key={item.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">{lead.full_name}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{interest?.motorcycle_model || "Sem modelo"} · {lead.city}</p>
                  <p className="mt-3 text-sm font-bold text-slate-700">{item.reason}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{followUpPriorityLabels[item.priority] || item.priority}</p>
                  <p className="mt-1 text-xs font-black text-orange-700">{days < 0 ? `${Math.abs(days)} dia(s) atrasado` : days === 0 ? "Hoje" : `Faltam ${days} dia(s)`} · {formatDateTime(item.due_at)}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[360px]">
                  <WhatsappButton leadId={lead.id} href={whatsappUrl(lead.phone, whatsappMessage({ full_name: lead.full_name, phone: lead.phone, status: lead.status, reason: item.reason, model: interest?.motorcycle_model }))} />
                  <Link href={`/leads/${lead.id}`} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 text-xs font-black">Abrir cliente</Link>
                  {item.status !== "concluido" && (
                    <>
                      <form action={completeFollowUpFormAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="completion_notes" value="Concluído pela tela de retornos." />
                        <SubmitButton className="flex min-h-10 w-full items-center justify-center rounded-lg bg-[#031A4A] text-xs font-black text-white">Concluir</SubmitButton>
                      </form>
                      <PostponeFollowUp id={item.id} reason={item.reason || "Retorno"} />
                      <details className="rounded-lg border border-slate-200 p-2 sm:col-span-2">
                        <summary className="cursor-pointer text-center text-xs font-black text-slate-500">Mais opções</summary>
                        <form action={cancelFollowUpFormAction} className="mt-2">
                          <input type="hidden" name="id" value={item.id} />
                          <SubmitButton className="flex min-h-10 w-full items-center justify-center rounded-lg bg-rose-50 text-xs font-black text-rose-700">Cancelar</SubmitButton>
                        </form>
                      </details>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
