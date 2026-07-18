import { notFound } from "next/navigation";
import Link from "next/link";
import { addNoteFormAction, archiveLeadFormAction, completeFollowUpFormAction, createFollowUpFormAction, deleteSimulationFormAction, markContactCompletedAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { LeadEditPanel, LeadStatusForm, SimulationEditForm, SimulationForm } from "@/components/lead-detail-forms";
import { LeadTabs } from "@/components/lead-tabs";
import { PostponeFollowUp } from "@/components/postpone-follow-up";
import { WhatsappButton } from "@/components/whatsapp-button";
import { getAppContext, getLeadById } from "@/lib/data";
import { followUpPriorityLabels, formatCurrency, formatDate, formatDateTime, resultLabels, statusLabels, whatsappMessage, whatsappUrl } from "@/lib/crm";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const { profile } = await getAppContext();
  const data = await getLeadById(routeParams.id);
  if (!data.lead) notFound();

  const lead = data.lead;
  const seller = data.profiles.find((item) => item.id === lead.assigned_user_id);
  const nextFollowUp = data.followUps.find((item) => item.status === "pendente" || item.status === "adiado");
  const message = whatsappMessage({
    full_name: lead.full_name,
    phone: lead.phone,
    status: lead.status,
    reason: nextFollowUp?.reason || data.simulations[0]?.denial_reason,
    model: data.interest?.motorcycle_model,
  });
  const history = [
    ...data.timeline.map((event) => ({ id: `timeline-${event.id}`, date: event.created_at, title: event.title, description: event.description || "Evento registrado." })),
    ...data.followUps.map((item) => ({ id: `return-${item.id}`, date: item.updated_at || item.created_at, title: `Retorno: ${item.status}`, description: `${item.reason} - ${formatDateTime(item.due_at)}` })),
    ...data.notes.map((note) => ({ id: `note-${note.id}`, date: note.created_at, title: "Observação", description: note.content })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-5">
      <header className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Cliente</p>
            <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">{lead.full_name}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{data.interest?.motorcycle_model || "Sem modelo"} - {lead.city}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{statusLabels[lead.status as keyof typeof statusLabels]}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{lead.temperature}</span>
            </div>
          </div>
          <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-[520px]">
            <WhatsappButton leadId={lead.id} href={whatsappUrl(lead.phone, message)} className="min-h-11 text-sm" />
            <a href={`tel:${lead.phone}`} className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 text-sm font-black">Ligar</a>
            <form action={markContactCompletedAction}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <SubmitButton className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#031A4A] text-sm font-black text-white">Contato realizado</SubmitButton>
            </form>
          </div>
        </div>
      </header>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Próxima ação</p>
        {nextFollowUp ? (
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#031A4A]">{nextFollowUp.reason}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(nextFollowUp.due_at)}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[260px]">
              <form action={completeFollowUpFormAction}>
                <input type="hidden" name="id" value={nextFollowUp.id} />
                <input type="hidden" name="completion_notes" value="Concluído pela página do cliente." />
                <SubmitButton className="flex min-h-10 w-full items-center justify-center rounded-lg bg-[#031A4A] text-xs font-black text-white">Concluir</SubmitButton>
              </form>
              <PostponeFollowUp id={nextFollowUp.id} reason={nextFollowUp.reason || "Retorno"} />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-slate-500">Nenhuma ação marcada.</p>
        )}
      </section>

      <LeadTabs
        resumo={
          <Card title="Resumo">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Telefone" value={lead.phone} />
              <Info label="Entrada" value={formatCurrency(data.interest?.intended_down_payment)} />
              <Info label="Modelo" value={data.interest?.motorcycle_model || "-"} />
              <Info label="Responsável" value={seller?.full_name || "Sem responsável"} />
              <Info label="Origem" value={lead.source} />
              <Info label="Observação recente" value={data.notes[0]?.content || "-"} />
            </dl>
          </Card>
        }
        simulacoes={
          <Card title="Simulações">
            <div className="space-y-3">
              {data.simulations.length === 0 && <Empty text="Nenhuma simulação registrada." />}
              {data.simulations.map((item) => (
                <article key={item.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-black">{formatDate(item.simulation_date || item.created_at)}</p>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black">{resultLabels[item.result as keyof typeof resultLabels]}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{item.denial_reason || item.notes || "Sem observação"}</p>
                  {profile?.role === "admin" && (
                    <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <summary className="cursor-pointer text-sm font-black text-[#031A4A]">Editar ou excluir</summary>
                      <div className="mt-3 grid gap-3">
                        <SimulationEditForm simulation={item} />
                        <form action={deleteSimulationFormAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="lead_id" value={lead.id} />
                          <SubmitButton className="flex min-h-10 w-full items-center justify-center rounded-lg border border-rose-200 bg-white text-xs font-black text-rose-700">
                            Excluir simulação
                          </SubmitButton>
                        </form>
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
            <details className="mt-4 rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-black text-[#031A4A]">+ Nova simulação</summary>
              <div className="mt-3">
                <SimulationForm leadId={lead.id} />
              </div>
            </details>
          </Card>
        }
        historico={
          <Card title="Histórico">
            <div className="space-y-4">
              {history.length === 0 && <Empty text="Nenhum histórico registrado." />}
              {history.map((event) => (
                <div key={event.id} className="border-l-2 border-orange-200 pl-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">{formatDateTime(event.date)}</p>
                  <p className="font-black text-slate-950">{event.title}</p>
                  <p className="text-sm font-semibold text-slate-600">{event.description}</p>
                </div>
              ))}
            </div>
          </Card>
        }
        mais={
          <div className="space-y-4">
            <LeadEditPanel lead={lead} interest={data.interest} />
            <ExpandableCard title="Alterar status">
              <LeadStatusForm leadId={lead.id} currentStatus={lead.status} isAdmin={profile?.role === "admin"} />
            </ExpandableCard>
            <ExpandableCard title="Criar retorno">
              <form action={createFollowUpFormAction} className="grid gap-3">
                <p className="rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600">
                  Retorno é um lembrete para você falar com o cliente depois: ligar, chamar no WhatsApp, pedir documento ou tentar nova simulação.
                </p>
                <input type="hidden" name="lead_id" value={lead.id} />
                <input type="hidden" name="assigned_user_id" value={lead.assigned_user_id || profile?.id} />
                <select name="reason" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" required>
                  <option value="">O que precisa fazer?</option>
                  <option value="Chamar no WhatsApp para continuar atendimento">Chamar no WhatsApp</option>
                  <option value="Ligar para o cliente">Ligar para o cliente</option>
                  <option value="Tentar nova simulação">Tentar nova simulação</option>
                  <option value="Cobrar documentos pendentes">Cobrar documentos</option>
                  <option value="Confirmar vinda na loja">Confirmar vinda na loja</option>
                  <option value="Ver se ainda tem interesse na moto">Ver se ainda tem interesse</option>
                </select>
                <input type="datetime-local" name="due_at" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" required />
                <select name="priority" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold">
                  {Object.entries(followUpPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <SubmitButton>Criar lembrete</SubmitButton>
              </form>
            </ExpandableCard>
            <ExpandableCard title="Adicionar observação">
              <form action={addNoteFormAction} className="grid gap-2">
                <input type="hidden" name="lead_id" value={lead.id} />
                <textarea name="content" rows={3} placeholder="Adicionar observação" className="rounded-lg border border-slate-200 px-3 py-3 text-sm font-bold" />
                <SubmitButton>Adicionar observação</SubmitButton>
              </form>
            </ExpandableCard>
            {profile?.role === "admin" && (
              <ExpandableCard title="Excluir cliente">
                <form action={archiveLeadFormAction} className="grid gap-3">
                  <input type="hidden" name="lead_id" value={lead.id} />
                  <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">
                    O cliente será removido das listas, mas o histórico fica preservado no banco.
                  </p>
                  <label className="flex items-start gap-2 text-sm font-bold text-slate-700">
                    <input type="checkbox" name="confirm_delete" value="true" required className="mt-1" />
                    Confirmo que quero excluir este cliente das listas.
                  </label>
                  <SubmitButton className="flex min-h-11 w-full items-center justify-center rounded-lg bg-rose-600 text-sm font-black text-white">
                    Excluir cliente
                  </SubmitButton>
                </form>
              </ExpandableCard>
            )}
            <Link href="/leads" className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black">Voltar para clientes</Link>
          </div>
        }
      />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-[#031A4A]">{title}</h2>
      {children}
    </section>
  );
}

function ExpandableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl bg-white p-4 shadow-sm">
      <summary className="cursor-pointer list-none text-lg font-black text-[#031A4A]">{title}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 font-bold text-slate-700">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</p>;
}
