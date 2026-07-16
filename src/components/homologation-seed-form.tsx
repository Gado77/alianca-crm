"use client";

import { useActionState } from "react";
import { seedHomologationAction } from "@/app/actions";
import { ActionMessage, SubmitButton } from "@/components/form-status";

const initialState = { ok: false, message: "" };

export function HomologationSeedForm() {
  const [state, action] = useActionState(seedHomologationAction, initialState);

  return (
    <form action={action} className="grid gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div>
        <h2 className="text-lg font-black text-[#031A4A]">Seed fictício opcional</h2>
        <p className="mt-1 text-sm font-bold text-orange-800">
          Cria dois vendedores, cinco leads, interesses, simulações, retornos e uma venda finalizada. Use somente em homologação.
        </p>
      </div>
      <ActionMessage state={state} />
      <SubmitButton>Executar seed fictício</SubmitButton>
    </form>
  );
}
