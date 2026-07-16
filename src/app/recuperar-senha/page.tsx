import Link from "next/link";
import { PasswordResetForm } from "@/components/login-form";

export default function RecoverPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-[#031A4A]">Recuperar senha</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">Informe seu email para receber as instruções.</p>
        <div className="mt-6">
          <PasswordResetForm />
        </div>
        <Link href="/login" className="mt-5 block text-sm font-black text-orange-600">Voltar ao login</Link>
      </section>
    </main>
  );
}
