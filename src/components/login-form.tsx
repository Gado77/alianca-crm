"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useState, useTransition } from "react";
import { requestPasswordResetAction, updatePasswordAction, type ActionState } from "@/app/actions";
import { ActionMessage, SubmitButton } from "@/components/form-status";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const initialState: ActionState = { ok: false, message: "" };

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<ActionState>(initialState);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setState({ ok: false, message: "Email ou senha inválidos." });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("active").eq("id", user.id).maybeSingle();
        if (!profile?.active) {
          await supabase.auth.signOut();
          setState({ ok: false, message: "Usuário desativado. Fale com um administrador." });
          return;
        }
      }

      setState({ ok: true, message: "" });
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ActionMessage state={state} />
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">Email</span>
        <input name="email" type="email" required className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">Senha</span>
        <input name="password" type="password" required className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#E84A2A] px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

export function PasswordResetForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialState);
  return (
    <form action={action} className="space-y-4">
      <ActionMessage state={state} />
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">Email</span>
        <input name="email" type="email" required className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400" />
      </label>
      <SubmitButton className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#031A4A] px-4 text-sm font-black text-white">
        Enviar recuperação
      </SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialState);
  return (
    <form action={action} className="space-y-4">
      <ActionMessage state={state} />
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">Nova senha</span>
        <input name="password" type="password" minLength={8} required className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400" />
      </label>
      <SubmitButton className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#031A4A] px-4 text-sm font-black text-white">
        Atualizar senha
      </SubmitButton>
    </form>
  );
}
