import { getLeadCollections } from "@/lib/data";
import { sourceLabels, statusLabels } from "@/lib/crm";

export default async function StatsPage() {
  const { leads, interests, simulations, followUps, profiles } = await getLeadCollections();
  const active = leads.filter((lead) => lead.active);
  const byModel = groupCount(interests, "motorcycle_model");
  const byCity = groupCount(active, "city");
  const byOrigin = groupCount(active, "source");
  const bySeller = Object.fromEntries(
    profiles.map((profile) => [profile.full_name, active.filter((lead) => lead.assigned_user_id === profile.id).length])
  );
  const byDenial = groupCount(simulations.filter((item) => item.result === "negado"), "denial_reason");
  const overdue = followUps.filter((item) => item.status === "pendente" && new Date(item.due_at) < new Date()).length;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Estatísticas</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Indicadores comerciais</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Gráficos simples e legíveis para mobile.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Leads ativos" value={active.length} />
        <Metric title="Vendas finalizadas" value={active.filter((lead) => lead.status === "venda_finalizada").length} />
        <Metric title="Aprovações" value={simulations.filter((item) => item.result === "aprovado").length} />
        <Metric title="Retornos atrasados" value={overdue} />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <Chart title="Conversão por modelo" data={byModel} />
        <Chart title="Leads por cidade" data={byCity} />
        <Chart title="Leads por vendedor" data={bySeller} />
        <Chart title="Leads por origem" data={renameKeys(byOrigin, sourceLabels)} />
        <Chart title="Motivos de negativa" data={byDenial} />
        <Chart title="Status" data={renameKeys(groupCount(active, "status"), statusLabels)} />
      </section>
    </div>
  );
}

function groupCount(rows: Array<Record<string, unknown>>, key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] || "Não informado");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renameKeys(data: Record<string, number>, labels: Record<string, string>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [labels[key] || key, value]));
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-3 text-3xl font-black text-[#031A4A]">{value}</p>
    </article>
  );
}

function Chart({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-[#031A4A]">{title}</h2>
      <div className="mt-4 space-y-3">
        {Object.entries(data).map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs font-black text-slate-500">
              <span>{label}</span>
              <span>{value}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-orange-500" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
