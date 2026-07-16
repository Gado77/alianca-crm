"use client";

import { useActionState, useMemo, useState } from "react";
import { Camera, FileScan, RotateCcw } from "lucide-react";
import { createLeadFormAction, extractFichaAction, type FichaImportState } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { paymentLabels } from "@/lib/crm";
import type { ProfileRow } from "@/lib/data";

const initialState: FichaImportState = {
  ok: false,
  message: "",
};

export function FichaImportForm({ profile, profiles }: { profile?: ProfileRow | null; profiles: ProfileRow[] }) {
  const [state, action, pending] = useActionState(extractFichaAction, initialState);
  const [imageUrl, setImageUrl] = useState("");
  const [localError, setLocalError] = useState("");
  const extracted = state.extracted;
  const previewStyle = useMemo(() => ({ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }), [imageUrl]);

  function handlePreview(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Envie uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setLocalError("A foto ficou grande demais. Tire outra foto mais leve ou reduza para ate 6 MB.");
      return;
    }
    setLocalError("");
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
  }

  function reset() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl("");
    setLocalError("");
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <form action={action} className="grid gap-4">
          <div>
            <h2 className="text-lg font-black text-[#031A4A]">Escanear ficha</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              A IA le a ficha e voce confere tudo antes de criar o lead.
            </p>
          </div>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
            <Camera className="h-8 w-8 text-orange-600" />
            <span className="text-sm font-black text-slate-700">Tirar foto ou escolher imagem da ficha</span>
            <span className="text-xs font-bold text-slate-500">JPG, PNG ou WEBP. Use foto legivel e sem cortes nos campos.</span>
            <input
              name="ficha"
              type="file"
              accept="image/*"
              capture="environment"
              required
              disabled={pending}
              className="sr-only"
              onChange={(event) => handlePreview(event.target.files?.[0])}
            />
          </label>
          {localError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{localError}</p>}
          {state.message && (
            <p className={`rounded-lg px-3 py-2 text-sm font-bold ${state.ok ? "bg-orange-50 text-orange-800" : "bg-red-50 text-red-700"}`}>
              {state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || Boolean(localError)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#031A4A] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileScan className="h-4 w-4" />
            {pending ? "Lendo com IA..." : "Ler ficha com IA"}
          </button>
        </form>
      </section>

      {imageUrl && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="sticky top-20">
              <div className="min-h-[420px] rounded-lg bg-slate-100 bg-contain bg-center bg-no-repeat" style={previewStyle} />
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-[#031A4A]">Conferir antes de salvar</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Ajuste qualquer campo olhando a foto ao lado.</p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700"
              >
                <RotateCcw className="h-4 w-4" />
                Nova ficha
              </button>
            </div>

            {extracted ? (
              <ReviewForm
                key={`${extracted.full_name}-${extracted.cpf}-${extracted.phone}-${extracted.payment_method}`}
                extracted={extracted}
                profile={profile}
                profiles={profiles}
              />
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm font-bold text-slate-500">
                <FileScan className="mr-2 h-4 w-4" />
                Envie a imagem para liberar a conferencia.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewForm({
  extracted,
  profile,
  profiles,
}: {
  extracted: NonNullable<FichaImportState["extracted"]>;
  profile?: ProfileRow | null;
  profiles: ProfileRow[];
}) {
  const [paymentMethod, setPaymentMethod] = useState<string>(extracted.payment_method);

  return (
    <form action={createLeadFormAction} className="grid gap-3">
      <Field name="full_name" label="Nome completo" defaultValue={extracted.full_name} required />
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="cpf" label="CPF" defaultValue={extracted.cpf} required />
        <Field name="phone" label="Telefone / WhatsApp" defaultValue={extracted.phone} required />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="city" label="Cidade" defaultValue={extracted.city} required />
        <Field name="birth_date" label="Data de nascimento" type="date" defaultValue={extracted.birth_date} />
      </div>
      <Field name="email" label="Email" type="email" defaultValue={extracted.email} />
      <Select name="license_category" label="CNH" defaultValue={extracted.license_category}>
        <option value="nao_possui">Nao possui CNH</option>
        <option value="a">Categoria A</option>
        <option value="ab">Categoria A e B</option>
      </Select>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="motorcycle_model" label="Modelo de interesse" defaultValue={extracted.motorcycle_model} required />
        <Field name="desired_color" label="Cor" defaultValue={extracted.desired_color} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="intended_down_payment" label="Entrada pretendida" type="number" defaultValue={extracted.intended_down_payment} />
        <label>
          <span className="mb-2 block text-sm font-black text-slate-700">Forma de pagamento</span>
          <select
            name="payment_method"
            defaultValue={extracted.payment_method}
            onChange={(event) => setPaymentMethod(event.target.value)}
            className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400"
          >
            {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {paymentMethod === "outro" && <Field name="other_payment_method" label="Qual forma de pagamento?" defaultValue={extracted.other_payment_method} />}
      <input type="hidden" name="source" value="manual" />
      {profile?.role === "admin" && profiles.length > 1 && (
        <Select name="assigned_user_id" label="Responsavel" defaultValue="">
          <option value="">Eu mesmo / sem responsavel</option>
          {profiles.filter((item) => item.active).map((seller) => <option key={seller.id} value={seller.id}>{seller.full_name}</option>)}
        </Select>
      )}
      <label>
        <span className="mb-2 block text-sm font-black text-slate-700">Observacoes</span>
        <textarea name="notes" rows={4} defaultValue={extracted.notes} className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base font-semibold outline-none focus:border-orange-400" />
      </label>
      <label className="flex min-h-11 items-center gap-2 rounded-lg bg-orange-50 px-3 text-sm font-bold text-orange-800">
        <input type="checkbox" name="duplicate_confirmed" value="true" />
        Confirmo continuar se houver possivel duplicidade
      </label>
      <SubmitButton>Criar lead conferido</SubmitButton>
    </form>
  );
}

function Field({ name, label, type = "text", required = false, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string | number | null }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue || ""} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400" />
    </label>
  );
}

function Select({ name, label, children, defaultValue }: { name: string; label: string; children: React.ReactNode; defaultValue?: string }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <select name={name} defaultValue={defaultValue} className="h-12 w-full rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-orange-400">{children}</select>
    </label>
  );
}
