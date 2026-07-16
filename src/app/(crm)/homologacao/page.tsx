import { notFound } from "next/navigation";
import { HomologationChecklist } from "@/components/homologation-checklist";
import { HomologationSeedForm } from "@/components/homologation-seed-form";
import { getAppContext } from "@/lib/data";
import { homologationItems } from "@/lib/homologation";

export default async function HomologationPage() {
  const { profile } = await getAppContext();
  const homologationEnabled =
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_HOMOLOGATION === "true";

  if (!homologationEnabled) notFound();
  if (profile?.role !== "admin") notFound();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Homologação</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Checklist de validação pela interface</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Marcação manual para desktop e mobile. Não há aprovação automática.
        </p>
      </header>
      <HomologationSeedForm />
      <HomologationChecklist items={homologationItems} />
    </div>
  );
}
