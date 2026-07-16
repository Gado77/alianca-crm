import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Image src="/brand/logo-horizontal.webp" alt="Aliança Motos Avelloz" width={192} height={64} className="h-auto w-[190px]" priority />
        <h1 className="mt-8 text-2xl font-black text-[#031A4A]">Entrar no Aliança CRM</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Acesso restrito. Usuários são criados apenas por administradores.
        </p>
        {params?.error === "inactive" && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            Seu usuário está desativado. Fale com um administrador.
          </p>
        )}
        <div className="mt-6">
          <LoginForm />
        </div>
        <Link href="/recuperar-senha" className="mt-5 block text-sm font-black text-orange-600">
          Esqueci minha senha
        </Link>
      </section>
    </main>
  );
}
