import { notFound } from "next/navigation";
import { getAppContext, getLeadCollections } from "@/lib/data";

export default async function StatsPage() {
  const { profile } = await getAppContext();
  if (profile?.role !== "admin") notFound();

  const { leads, simulations, followUps } = await getLeadCollections();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const isThisMonth = (value?: string | null) => {
    if (!value) return false;
    const date = new Date(value);
    return date.getMonth() === month && date.getFullYear() === year;
  };

  const monthLeads = leads.filter((lead) => lead.active && isThisMonth(lead.created_at));
  const monthSimulations = simulations.filter((simulation) => isThisMonth(simulation.created_at || simulation.simulation_date));
  const approved = monthSimulations.filter((simulation) => simulation.result === "aprovado");
  const sales = leads.filter((lead) => lead.active && lead.status === "venda_finalizada" && isThisMonth(lead.updated_at || lead.created_at));
  const overdue = followUps.filter((item) => item.status === "pendente" && new Date(item.due_at) < now).length;
  const denialReasons = topReasons(monthSimulations.filter((item) => item.result === "negado"));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Resumo mensal</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Indicadores comerciais</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Visão simples para acompanhar o mês sem poluir a operação.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Clientes cadastrados no mês" value={monthLeads.length} />
        <Metric title="Simulações realizadas" value={monthSimulations.length} />
        <Metric title="Simulações aprovadas" value={approved.length} />
        <Metric title="Vendas finalizadas" value={sales.length} />
        <Metric title="Retornos atrasados" value={overdue} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-[#031A4A]">Principais motivos de negativa</h2>
        <div className="mt-4 space-y-2">
          {denialReasons.length === 0 && <p className="text-sm font-semibold text-slate-500">Nenhum motivo registrado neste mês.</p>}
          {denialReasons.map(([reason, count]) => (
            <div key={reason} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold">
              <span>{reason}</span>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function topReasons(rows: Array<Record<string, unknown>>) {
  const grouped = rows.reduce<Record<string, number>>((acc, row) => {
    const reason = String(row.denial_reason || "Não informado");
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-black text-[#031A4A]">{value}</p>
    </article>
  );
}
