import { onlyDigits } from "@/lib/crm";

export type FichaExtractedLead = {
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

export type FichaImportState = {
  ok: boolean;
  message: string;
  extracted?: FichaExtractedLead;
};

export async function extractFichaWithVision(file: File): Promise<FichaImportState> {
  const provider = (process.env.VISION_PROVIDER || "groq").toLowerCase();
  if (provider !== "groq") {
    return { ok: false, message: "Provider de visao nao configurado. Use VISION_PROVIDER=groq." };
  }
  return extractFichaWithGroq(file);
}

async function extractFichaWithGroq(file: File): Promise<FichaImportState> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  if (!apiKey) return { ok: false, message: "Configure GROQ_API_KEY no ambiente do servidor para ler fichas por IA." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Envie uma imagem JPG, PNG ou WEBP." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, message: "A imagem precisa ter ate 3 MB." };

  try {
    const imageData = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = normalizeImageMimeType(file.type);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: fichaPrompt() },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageData}`,
                },
              },
            ],
          },
        ],
        temperature: 0,
        max_completion_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("extractFichaWithGroq", {
        status: response.status,
        model,
        detail: detail.slice(0, 500),
      });
      return { ok: false, message: groqErrorMessage(response.status, detail) };
    }

    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, message: "A Groq nao retornou dados da ficha. Tente outra foto." };
    }

    return {
      ok: true,
      message: `Ficha lida pela IA Groq (${model}). Confira tudo antes de salvar.`,
      extracted: normalizeFichaLead(JSON.parse(extractJsonText(text))),
    };
  } catch (error) {
    console.error("extractFichaWithGroq", error instanceof Error ? error.message : "unknown");
    return { ok: false, message: "Nao foi possivel interpretar a ficha. Confira a foto e tente novamente." };
  }
}

function normalizeFichaLead(raw: Record<string, unknown>): FichaExtractedLead {
  const stringValue = (key: string) => (typeof raw[key] === "string" ? raw[key].trim() : "");
  return {
    full_name: stringValue("full_name"),
    cpf: onlyDigits(stringValue("cpf")).slice(0, 11),
    phone: normalizeFichaPhone(stringValue("phone")),
    city: stringValue("city"),
    email: stringValue("email"),
    birth_date: normalizeFichaDate(stringValue("birth_date")),
    license_category: normalizeFichaLicense(stringValue("license_category")),
    motorcycle_model: normalizeFichaModel(stringValue("motorcycle_model")),
    desired_color: stringValue("desired_color"),
    intended_down_payment: normalizeFichaMoney(raw.intended_down_payment),
    payment_method: normalizeFichaPayment(stringValue("payment_method")),
    other_payment_method: stringValue("other_payment_method"),
    notes: stringValue("notes"),
  };
}

function normalizeFichaPhone(value: string) {
  const digits = onlyDigits(value);
  if (digits.startsWith("55") && digits.length > 11) return digits.slice(2, 13);
  return digits.slice(0, 11);
}

function normalizeFichaDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})/);
  if (!match) return "";
  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const yearNumber = Number(match[3]);
  const year = yearNumber < 100 ? String(yearNumber > 30 ? 1900 + yearNumber : 2000 + yearNumber) : match[3];
  return `${year}-${month}-${day}`;
}

function normalizeFichaLicense(value: string): FichaExtractedLead["license_category"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("ab") || normalized.includes("a e b")) return "ab";
  if (normalized === "a" || normalized.includes("categoria a") || normalized.includes("sim")) return "a";
  return "nao_possui";
}

function normalizeFichaPayment(value: string): FichaExtractedLead["payment_method"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("cart")) return "cartao";
  if (normalized.includes("vista")) return "a_vista";
  if (normalized.includes("cons")) return "consorcio";
  if (normalized.includes("outro")) return "outro";
  return "financiamento";
}

function normalizeFichaMoney(value: unknown): number | "" {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return "";
  const digits = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "";
}

function normalizeFichaModel(value: string) {
  const normalized = value.toUpperCase().replace(/\s+/g, " ").trim();
  if (normalized.includes("160")) return "AZ 160 X-TREME";
  if (normalized.includes("125")) return "AZ125-ALFA";
  if (normalized.includes("AZ1")) return "AZ1";
  return value;
}

function fichaPrompt() {
  return [
    "Extraia os dados desta ficha manuscrita da Alianca Motos para cadastro de lead.",
    "Leia campos escritos e caixas marcadas. Considere caixa marcada quando houver X, risco, check ou rabisco dentro/proximo da opcao.",
    "Nunca invente dado. Se estiver ilegivel, deixe vazio.",
    "Retorne somente JSON valido com as chaves: full_name, cpf, phone, city, email, birth_date, license_category, motorcycle_model, desired_color, intended_down_payment, payment_method, other_payment_method, notes.",
    "license_category deve ser a, ab ou nao_possui. payment_method deve ser financiamento, cartao, a_vista, consorcio ou outro.",
  ].join("\n");
}

function groqErrorMessage(status: number, detail: string) {
  const parsedDetail = providerErrorDetail(detail);
  if (status === 400) return `A Groq recusou a imagem ou a chamada. ${parsedDetail ? `Detalhe: ${parsedDetail}` : "Tente outra foto ou confira GROQ_MODEL na Vercel."}`;
  if (status === 401 || status === 403) return "A chave Groq nao tem permissao para essa chamada. Confira GROQ_API_KEY na Vercel.";
  if (status === 404) return "Modelo Groq nao encontrado. Use meta-llama/llama-4-scout-17b-16e-instruct.";
  if (status === 413) return "A foto ficou grande demais para a Groq. Tente uma imagem mais leve.";
  if (status === 429) return "A Groq bloqueou por limite de uso agora. Aguarde um pouco e tente novamente.";
  if (status >= 500) return "A Groq ficou indisponivel no momento. Tente novamente em instantes.";
  return "Nao foi possivel ler a ficha agora. Tente novamente.";
}

function providerErrorDetail(detail: string) {
  try {
    const parsed = JSON.parse(detail) as { error?: { message?: string } };
    return parsed.error?.message?.replace(/\s+/g, " ").slice(0, 180) || "";
  } catch {
    return detail.replace(/\s+/g, " ").slice(0, 180);
  }
}

function extractJsonText(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function normalizeImageMimeType(type: string) {
  if (type === "image/jpg") return "image/jpeg";
  return type;
}
