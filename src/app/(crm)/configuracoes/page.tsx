export default function SettingsPage() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Configurações</p>
      <h1 className="mt-1 text-2xl font-black text-[#031A4A]">Configurações</h1>
      <p className="mt-3 text-sm font-semibold text-slate-600">
        Nesta etapa de homologação, as configurações sensíveis ficam no Supabase e em variáveis server-side. A service role não é exposta no cliente.
      </p>
    </section>
  );
}
