import { UpdatePasswordForm } from "@/components/login-form";

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7FB] px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black text-[#031A4A]">Redefinir senha</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">Digite a nova senha para continuar.</p>
        <div className="mt-6">
          <UpdatePasswordForm />
        </div>
      </section>
    </main>
  );
}
