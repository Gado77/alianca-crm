"use client";

import { useMemo, useState } from "react";
import { Camera, FileScan, RotateCcw } from "lucide-react";
import { createLeadFormAction } from "@/app/actions";
import { SubmitButton } from "@/components/form-status";
import { onlyDigits, paymentLabels } from "@/lib/crm";
import type { ProfileRow } from "@/lib/data";

type ExtractedLead = {
  full_name: string;
  cpf: string;
  phone: string;
  city: string;
  email: string;
  birth_date: string;
  license_category: "a" | "ab" | "nao_possui";
  motorcycle_model: string;
  desired_color: string;
  intended_down_payment: number | "";
  payment_method: "financiamento" | "cartao" | "a_vista" | "consorcio" | "outro";
  other_payment_method: string;
  notes: string;
};

const emptyLead: ExtractedLead = {
  full_name: "",
  cpf: "",
  phone: "",
  city: "",
  email: "",
  birth_date: "",
  license_category: "nao_possui",
  motorcycle_model: "",
  desired_color: "",
  intended_down_payment: "",
  payment_method: "financiamento",
  other_payment_method: "",
  notes: "",
};

export function FichaImportForm({ profile, profiles }: { profile?: ProfileRow | null; profiles: ProfileRow[] }) {
  const [imageUrl, setImageUrl] = useState("");
  const [extracted, setExtracted] = useState<ExtractedLead | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("financiamento");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [pending, setPending] = useState(false);

  const previewStyle = useMemo(() => ({ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined }), [imageUrl]);

  async function handleFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Envie uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage("A imagem precisa ter ate 8 MB.");
      return;
    }

    setMessage("");
    setProgress("Preparando imagem...");
    setPending(true);
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    try {
      const { recognize } = await import("tesseract.js");
      setProgress("Lendo texto da ficha...");
      const result = await recognize(file, "por", {
        logger: (event) => {
          if (event.status === "recognizing text") {
            setProgress(`Lendo texto... ${Math.round(event.progress * 100)}%`);
          }
        },
      });
      const parsed = parseFichaText(result.data.text);
      setExtracted(parsed);
      setPaymentMethod(parsed.payment_method);
      setMessage("Leitura gratuita concluida. Confira os campos, porque letra de mao pode sair incompleta.");
    } catch (error) {
      console.error("freeFichaOcr", error instanceof Error ? error.message : "unknown");
      setExtracted(emptyLead);
      setMessage("Nao consegui ler automaticamente. A ficha ficou na tela para voce preencher conferindo pela imagem.");
    } finally {
      setProgress("");
      setPending(false);
    }
  }

  function reset() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl("");
    setExtracted(null);
    setPaymentMethod("financiamento");
    setMessage("");
    setProgress("");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="grid gap-4">
          <div>
            <h2 className="text-lg font-black text-[#031A4A]">Escanear ficha</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Leitura gratuita no navegador. Depois confira os dados antes de criar o lead.
            </p>
          </div>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
            <Camera className="h-8 w-8 text-orange-600" />
            <span className="text-sm font-black text-slate-700">Tirar foto ou escolher imagem da ficha</span>
            <span className="text-xs font-bold text-slate-500">JPG, PNG ou WEBP. Use foto legivel e sem cortes nos campos.</span>
            <input type="file" accept="image/*" capture="environment" disabled={pending} className="sr-only" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          {progress && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">{progress}</p>}
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm font-bold ${extracted ? "bg-orange-50 text-orange-800" : "bg-red-50 text-red-700"}`}>{message}</p>
          )}
        </div>
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
                extracted={extracted}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                profile={profile}
                profiles={profiles}
              />
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm font-bold text-slate-500">
                <FileScan className="mr-2 h-4 w-4" />
                Escolha uma imagem para liberar a conferencia.
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
  paymentMethod,
  setPaymentMethod,
  profile,
  profiles,
}: {
  extracted: ExtractedLead;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  profile?: ProfileRow | null;
  profiles: ProfileRow[];
}) {
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
        <option value="nao_possui">Não possui CNH</option>
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
        <Select name="assigned_user_id" label="Responsável" defaultValue="">
          <option value="">Eu mesmo / sem responsável</option>
          {profiles.filter((item) => item.active).map((seller) => <option key={seller.id} value={seller.id}>{seller.full_name}</option>)}
        </Select>
      )}
      <label>
        <span className="mb-2 block text-sm font-black text-slate-700">Observações</span>
        <textarea name="notes" rows={4} defaultValue={extracted.notes} className="w-full rounded-lg border border-slate-200 px-3 py-3 text-base font-semibold outline-none focus:border-orange-400" />
      </label>
      <label className="flex min-h-11 items-center gap-2 rounded-lg bg-orange-50 px-3 text-sm font-bold text-orange-800">
        <input type="checkbox" name="duplicate_confirmed" value="true" />
        Confirmo continuar se houver possível duplicidade
      </label>
      <SubmitButton>Criar lead conferido</SubmitButton>
    </form>
  );
}

function parseFichaText(text: string): ExtractedLead {
  const normalized = text.replace(/\s+/g, " ").trim();
  return {
    ...emptyLead,
    full_name: extractAfterLabel(text, /nome completo/i),
    cpf: extractCpf(normalized),
    phone: extractPhone(normalized),
    city: extractAfterLabel(text, /cidade\s*\/\s*estado|localiza[cç][aã]o/i),
    email: extractEmail(normalized),
    birth_date: extractDate(normalized),
    license_category: extractLicense(normalized),
    motorcycle_model: extractModel(text),
    desired_color: extractColor(text),
    intended_down_payment: extractMoney(normalized),
    payment_method: extractPayment(text),
  };
}

function extractAfterLabel(text: string, label: RegExp) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";
  const current = lines[index].replace(label, "").replace(/[:_\-]+/g, " ").trim();
  if (current.length > 2) return cleanText(current);
  return cleanText(lines[index + 1] || "");
}

function cleanText(value: string) {
  return value.replace(/[|_[\]{}<>]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractCpf(text: string) {
  const match = text.match(/\d{3}\D*\d{3}\D*\d{3}\D*\d{2}/);
  return match ? onlyDigits(match[0]).slice(0, 11) : "";
}

function extractPhone(text: string) {
  const matches = [...text.matchAll(/\(?\d{2}\)?\D*\d{4,5}\D*\d{4}/g)].map((match) => onlyDigits(match[0]));
  return matches.find((value) => value.length >= 10 && value.length <= 11) || "";
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractDate(text: string) {
  const match = text.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const yearNumber = Number(match[3]);
  const year = yearNumber < 100 ? String(yearNumber > 30 ? 1900 + yearNumber : 2000 + yearNumber) : match[3];
  return `${year}-${month}-${day}`;
}

function extractLicense(text: string): ExtractedLead["license_category"] {
  const lower = text.toLowerCase();
  if (/(categoria|cnh).{0,12}(a\s*e\s*b|ab)/i.test(lower)) return "ab";
  if (/(categoria|cnh).{0,12}\ba\b/i.test(lower)) return "a";
  if (/tem habilita[cç][aã]o.{0,20}(x|sim)/i.test(lower) && !/n[aã]o/.test(lower)) return "a";
  return "nao_possui";
}

function extractModel(text: string) {
  const upper = text.toUpperCase();
  if (/(X|✓|✔|☑|\*)\s*AZ\s*160|AZ\s*160.{0,8}(X|✓|✔|☑|\*)/.test(upper)) return "AZ 160 X-TREME";
  if (/(X|✓|✔|☑|\*)\s*AZ125|AZ125.{0,8}(X|✓|✔|☑|\*)/.test(upper)) return "AZ125-ALFA";
  if (/(X|✓|✔|☑|\*)\s*AZ1\b|AZ1.{0,8}(X|✓|✔|☑|\*)/.test(upper)) return "AZ1";
  return "";
}

function extractColor(text: string) {
  const colorLine = text.split(/\r?\n/).find((line) => /cor/i.test(line) && /[A-Za-zÀ-ÿ]{4,}/.test(line.replace(/cor/gi, "")));
  return colorLine ? cleanText(colorLine.replace(/cor/gi, "").replace(/[:_\-]+/g, " ")) : "";
}

function extractMoney(text: string): number | "" {
  const match = text.match(/R\$?\s*([\d.]+(?:,\d{2})?)/i) || text.match(/entrada.{0,30}([\d.]+(?:,\d{2})?)/i);
  if (!match) return "";
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : "";
}

function extractPayment(text: string): ExtractedLead["payment_method"] {
  const lower = text.toLowerCase();
  if (/(x|✓|✔|☑|\*)\s*cart[aã]o|cart[aã]o.{0,12}(x|✓|✔|☑|\*)/.test(lower)) return "cartao";
  if (/(x|✓|✔|☑|\*)\s*financiamento|financiamento.{0,12}(x|✓|✔|☑|\*)/.test(lower)) return "financiamento";
  if (/(x|✓|✔|☑|\*)\s*[aà]\s*vista|[aà]\s*vista.{0,12}(x|✓|✔|☑|\*)/.test(lower)) return "a_vista";
  if (/(x|✓|✔|☑|\*)\s*cons[oó]rcio|cons[oó]rcio.{0,12}(x|✓|✔|☑|\*)/.test(lower)) return "consorcio";
  if (/(x|✓|✔|☑|\*)\s*outra?|outra?.{0,12}(x|✓|✔|☑|\*)/.test(lower)) return "outro";
  return "financiamento";
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
