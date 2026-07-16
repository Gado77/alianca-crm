import { saveBankFormAction } from "@/app/actions";
import { BanksManager } from "@/components/banks-manager";
import { SubmitButton } from "@/components/form-status";
import { getAppContext, getBanks } from "@/lib/data";

export default async function BanksPage() {
  const { profile } = await getAppContext();
  const isAdmin = profile?.role === "admin";
  const banks = await getBanks(isAdmin);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Bancos</p>
        <h1 className="mt-1 text-2xl font-black text-[#031A4A] sm:text-3xl">Instituições financeiras</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Use “Outro banco” na simulação quando o banco não estiver cadastrado.</p>
      </header>
      {isAdmin && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-black text-[#031A4A]">Novo banco</h2>
          <form action={saveBankFormAction} className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
            <input name="name" placeholder="Nome do banco" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold" />
            <select name="active" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold">
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
            <SubmitButton>Salvar</SubmitButton>
          </form>
        </section>
      )}
      <BanksManager banks={banks} isAdmin={isAdmin} />
    </div>
  );
}
