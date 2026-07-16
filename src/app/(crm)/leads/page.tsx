import Link from "next/link";
import { FileScan, Plus, Search } from "lucide-react";
import { WhatsappButton } from "@/components/whatsapp-button";
import { getLeadCollections } from "@/lib/data";
import { formatDateTime, maskCpf, statusLabels, whatsappMessage, whatsappUrl } from "@/lib/crm";

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  const params = await searchParams;
  const { leads, interests, followUps } = await getLeadCollections();
  const query = (params?.q || "").toLowerCase();
  const status = params?.status || "todos";
  const interestByLead = new Map(interests.map((item) => [item.lead_id, item]));
  const nextFollowUpByLead = new Map(
    followUps
      .filter((item) => item.status === "pendente" || item.status === "adiado")
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())
      .map((item) => [item.lead_id, item])
  );

  const filtered = leads.filter((lead) => {
    const interest = interestByLead.get(lead.id);
    const haystack = `${lead.full_name} ${lead.cpf} ${lead.phone} ${lead.city} ${interest?.motorcycle_model || ""}`.toLowerCase();
    return lead.active && haystack.includes(query) && (status === "todos" || lead.status === status);
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Leads</p>
          <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Clientes</h1>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/leads/importar" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
            <FileScan className="h-4 w-4" />
            Importar Ficha
          </Link>
          <Link href="/leads/novo" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#E84A2A] px-4 text-sm font-black text-white">
            <Plus className="h-4 w-4" />
            Novo Lead
          </Link>
        </div>
      </header>

      <form className="grid gap-2 rounded-xl bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]">
        <label className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={params?.q || ""} placeholder="Nome, telefone, cidade, CPF ou modelo" className="w-full bg-transparent text-sm font-semibold outline-none" />
        </label>
        <details className="rounded-lg border border-slate-200 px-3 py-2">
          <summary className="cursor-pointer text-sm font-black text-slate-600">Filtros</summary>
          <select name="status" defaultValue={status} className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold">
            <option value="todos">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </details>
        <button className="min-h-11 rounded-lg bg-[#031A4A] px-4 text-sm font-black text-white sm:col-span-2">Pesquisar</button>
      </form>

      <section className="grid gap-3">
        {filtered.length === 0 && <p className="rounded-xl bg-white p-5 text-sm font-semibold text-slate-500 shadow-sm">Nenhum cliente encontrado.</p>}
        {filtered.map((lead) => {
          const interest = interestByLead.get(lead.id);
          const next = nextFollowUpByLead.get(lead.id);
          return (
            <article key={lead.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <Link href={`/leads/${lead.id}`} className="text-lg font-black text-slate-950">{lead.full_name}</Link>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{interest?.motorcycle_model || "Sem modelo"} · {lead.city}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{statusLabels[lead.status as keyof typeof statusLabels]}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">CPF {maskCpf(lead.cpf)}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    Próxima ação: {next ? `${next.reason} · ${formatDateTime(next.due_at)}` : "Sem retorno marcado"}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[260px]">
                  <WhatsappButton leadId={lead.id} href={whatsappUrl(lead.phone, whatsappMessage({ full_name: lead.full_name, phone: lead.phone, status: lead.status, model: interest?.motorcycle_model }))} />
                  <Link href={`/leads/${lead.id}`} className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 text-xs font-black">Abrir</Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
