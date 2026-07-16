import Link from "next/link";
import { FichaImportForm } from "@/components/ficha-import-form";
import { getAppContext, getProfiles } from "@/lib/data";

export default async function ImportFichaPage() {
  const { profile } = await getAppContext();
  const profiles = await getProfiles();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Importar ficha</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Criar lead pela ficha</h1>
        <Link href="/leads" className="mt-2 inline-flex text-sm font-black text-orange-600">Voltar para Leads</Link>
      </header>
      <FichaImportForm profile={profile} profiles={profiles} />
    </div>
  );
}
