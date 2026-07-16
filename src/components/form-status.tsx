"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ||
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#E84A2A] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ActionMessage({ state }: { state?: { ok: boolean; message: string } }) {
  if (!state?.message) return null;
  return (
    <p className={`rounded-lg px-3 py-2 text-sm font-bold ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {state.message}
    </p>
  );
}
