import { PipelineBoard } from "@/components/pipeline-board";
import { getLeadCollections } from "@/lib/data";

export default async function PipelinePage() {
  const { leads, interests, profiles } = await getLeadCollections();
  const interestByLead = new Map(interests.map((item) => [item.lead_id, item]));
  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const pipelineLeads = leads
    .filter((lead) => lead.active)
    .map((lead) => ({
      id: lead.id,
      full_name: lead.full_name,
      city: lead.city,
      status: lead.status,
      model: interestByLead.get(lead.id)?.motorcycle_model || null,
      seller: profileById.get(lead.assigned_user_id)?.full_name || null,
    }));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Andamento</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Acompanhamento dos clientes</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Arraste cards no desktop ou use o seletor de status no celular.</p>
      </header>
      <PipelineBoard leads={pipelineLeads} />
    </div>
  );
}
