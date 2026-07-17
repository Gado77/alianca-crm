"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Camera, FileScan, RotateCcw } from "lucide-react";
import { createLeadFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { paymentLabels } from "@/lib/crm";
import type { ProfileRow } from "@/lib/data";
import type { FichaImportState } from "@/lib/ficha-vision";

const initialState: FichaImportState = {
  ok: false,
  message: "",
};

export function FichaImportForm({ profile, profiles }: { profile?: ProfileRow | null; profiles: ProfileRow[] }) {
  const [state, setState] = useState<FichaImportState>(initialState);
  const [imageUrl, setImageUrl] = useState("");
  const [localError, setLocalError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extracted = state.extracted;
  const previewStyle = useMemo(() => ({ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }), [imageUrl]);

  async function handlePreview(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Envie uma imagem JPG, PNG ou WEBP.");
      return;
    }

    setPreparing(true);
    setLocalError("");
    try {
      const compressed = await compressFichaImage(file);
      if (compressed.size > 3 * 1024 * 1024) {
        setLocalError("A foto ainda ficou grande. Tire outra foto mais leve, de preferencia abaixo de 3 MB.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (fileInputRef.current) {
        const transfer = new DataTransfer();
        transfer.items.add(compressed);
        fileInputRef.current.files = transfer.files;
      }

      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(compressed));
    } catch (error) {
      console.error("compressFichaImage", error instanceof Error ? error.message : "unknown");
      setLocalError("Nao consegui preparar a imagem. Tente outra foto.");
    } finally {
      setPreparing(false);
    }
  }

  function reset() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl("");
    setLocalError("");
    window.location.reload();
  }

  async function handleExtract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setLocalError("Envie uma foto da ficha.");
      return;
    }

    setPending(true);
    setState(initialState);
    try {
      const formData = new FormData();
      formData.set("ficha", file);
      const response = await fetch("/api/ficha/extract", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null) as FichaImportState | null;
      if (!payload) {
        setState({ ok: false, message: "Nao foi possivel ler a resposta do servidor. Tente novamente." });
        return;
      }
      setState(payload);
    } catch (error) {
      console.error("handleExtract", error instanceof Error ? error.message : "unknown");
      setState({ ok: false, message: "Falha de conexao ao ler a ficha. Tente novamente." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <form onSubmit={handleExtract} className="grid gap-4">
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
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              required
              disabled={pending || preparing}
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
            disabled={pending || preparing || Boolean(localError)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#031A4A] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileScan className="h-4 w-4" />
            {preparing ? "Preparando foto..." : pending ? "Lendo com IA..." : "Ler ficha com IA"}
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

async function compressFichaImage(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable.");
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image compression failed.")), "image/jpeg", 0.78);
  });
  return new File([blob], "ficha-importada.jpg", { type: "image/jpeg" });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });
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
