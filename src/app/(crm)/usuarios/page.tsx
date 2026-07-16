import { createSellerFormAction, toggleUserActiveFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { getAppContext, getLeadCollections } from "@/lib/data";

export default async function UsersPage() {
  const { profile } = await getAppContext();
  const { profiles, leads } = await getLeadCollections();
  if (profile?.role !== "admin") {
    return <p className="rounded-lg bg-white p-5 text-sm font-bold text-slate-600">Apenas administradores acessam usuários.</p>;
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Usuários</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Vendedores e administradores</h1>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-black text-[#031A4A]">Criar vendedor</h2>
        <form action={createSellerFormAction} className="grid gap-3 md:grid-cols-2">
          <input name="full_name" placeholder="Nome" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
          <input name="phone" placeholder="Telefone" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
          <input name="email" type="email" placeholder="Email" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
          <input name="password" type="password" placeholder="Senha inicial" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
          <SubmitButton className="min-h-11 rounded-lg bg-[#E84A2A] text-sm font-black text-white md:col-span-2">Criar vendedor</SubmitButton>
        </form>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((item) => {
          const count = leads.filter((lead) => lead.assigned_user_id === item.id).length;
          return (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-lg font-black text-slate-950">{item.full_name}</p>
              <p className="text-sm font-bold text-slate-500">{item.role} · {item.phone || "Sem telefone"}</p>
              <p className="mt-2 text-sm font-bold text-slate-600">{count} leads atribuídos</p>
              <form action={toggleUserActiveFormAction} className="mt-4">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="active" value={String(!item.active)} />
                <SubmitButton className={`min-h-10 w-full rounded-lg text-xs font-black ${item.active ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {item.active ? "Desativar" : "Ativar"}
                </SubmitButton>
              </form>
            </article>
          );
        })}
      </section>
    </div>
  );
}
