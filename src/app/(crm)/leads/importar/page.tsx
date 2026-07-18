import Link from "next/link";
import { notFound } from "next/navigation";
import { FichaImportForm } from "@/components/ficha-import-form";
import { getAppContext, getProfiles } from "@/lib/data";

export default async function ImportFichaPage() {
  const { profile } = await getAppContext();
  if (profile?.role !== "admin") notFound();
  const profiles = await getProfiles();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Importar ficha</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Criar cliente pela ficha</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">A leitura pode conter erros. Confira e edite tudo antes de salvar.</p>
        <Link href="/leads" className="mt-2 inline-flex text-sm font-black text-orange-600">Voltar para clientes</Link>
      </header>
      <FichaImportForm profile={profile} profiles={profiles} />
    </div>
  );
}
