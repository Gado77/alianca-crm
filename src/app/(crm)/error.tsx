"use client";

export default function CrmError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="rounded-lg border border-rose-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Erro recuperável</p>
      <h1 className="mt-1 text-2xl font-black text-[#031A4A]">Não foi possível carregar esta tela</h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Tente novamente. Se persistir, registre o passo no checklist de homologação.
      </p>
      <button onClick={reset} className="mt-4 min-h-11 rounded-lg bg-[#031A4A] px-4 text-sm font-black text-white">
        Tentar novamente
      </button>
    </section>
  );
}
