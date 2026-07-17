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

export async function extractFichaWithGemini(file: File): Promise<FichaImportState> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "auto";
  if (!apiKey) return { ok: false, message: "Configure GEMINI_API_KEY no ambiente do servidor para ler fichas por IA." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Envie uma imagem JPG, PNG ou WEBP." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, message: "A imagem precisa ter ate 3 MB." };

  try {
    const imageData = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = normalizeImageMimeType(file.type);
    const availableModels = await listGeminiModels(apiKey);
    if (!availableModels.ok) return { ok: false, message: availableModels.message };
    if (availableModels.models.length === 0) {
      return { ok: false, message: "Essa chave Gemini nao retornou modelos com generateContent. Confira se ela foi criada no Google AI Studio." };
    }

    const selectedModels = chooseGeminiModels(model, availableModels.models);
    if (selectedModels.length === 0) {
      return { ok: false, message: `A chave Gemini listou modelos, mas nenhum parece utilizavel. Modelos listados: ${availableModels.models.slice(0, 8).join(", ")}.` };
    }

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: fichaPrompt() },
            { inlineData: { mimeType, data: imageData } },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    };

    let response: Response | null = null;
    let responseText = "";
    let usedModel = selectedModels[0];
    let usedVersion = availableModels.version;
    const attempts: string[] = [];

    for (const candidateModel of selectedModels) {
      usedModel = candidateModel;
      for (const endpointVersion of geminiEndpointVersions(availableModels.version)) {
        usedVersion = endpointVersion;
        const url = `https://generativelanguage.googleapis.com/${endpointVersion}/models/${candidateModel}:generateContent?key=${apiKey}`;
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        attempts.push(`${candidateModel}@${endpointVersion}:${response.status}`);
        if (response.ok) {
          responseText = "";
          break;
        }
        responseText = await response.text();
        if (response.status !== 404) break;
      }
      if (response?.ok || response?.status !== 404) break;
    }

    if (!response) return { ok: false, message: "Nao foi possivel chamar o Gemini agora. Tente novamente." };
    if (!response.ok) {
      const detail = responseText || await response.text();
      console.error("extractFichaWithGemini", {
        status: response.status,
        version: usedVersion,
        model: usedModel,
        attempts,
        availableModels: availableModels.models.slice(0, 12),
        detail: detail.slice(0, 500),
      });
      const suffix = response.status === 404
        ? ` Tentativas: ${attempts.join(", ")}. Ultimo modelo usado: ${usedModel}. Modelos listados: ${availableModels.models.slice(0, 5).join(", ") || "nenhum"}.`
        : "";
      return { ok: false, message: `${geminiErrorMessage(response.status, detail)}${suffix}` };
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text;
    if (!text) return { ok: false, message: "A leitura nao retornou dados. Tente outra foto." };

    return {
      ok: true,
      message: `Ficha lida pela IA (${usedVersion}/${usedModel}). Confira tudo antes de salvar.`,
      extracted: normalizeFichaLead(JSON.parse(extractJsonText(text))),
    };
  } catch (error) {
    console.error("extractFichaWithGemini", error instanceof Error ? error.message : "unknown");
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

function geminiErrorMessage(status: number, detail: string) {
  const normalized = detail.toLowerCase();
  const parsedDetail = geminiErrorDetail(detail);
  if (status === 400 && normalized.includes("api key")) return "A chave Gemini parece invalida. Confira GEMINI_API_KEY na Vercel.";
  if (status === 400) return `O Gemini recusou a imagem ou a chamada. ${parsedDetail ? `Detalhe: ${parsedDetail}` : "Tente outra foto ou confira GEMINI_MODEL na Vercel."}`;
  if (status === 401 || status === 403) return "A chave Gemini nao tem permissao para essa chamada. Confira a chave e restricoes no Google AI Studio.";
  if (status === 404) return "Nenhum modelo Gemini testado ficou disponivel nessa chave. Confira se a chave e do Google AI Studio e se a Generative Language API esta ativa.";
  if (status === 413) return "A foto ficou grande demais para a IA. Tente uma imagem mais leve.";
  if (status === 429) return "O Gemini bloqueou por limite de uso agora. Aguarde alguns minutos e tente novamente; se persistir, confira a cota do projeto no Google AI Studio.";
  if (status >= 500) return "O Gemini ficou indisponivel no momento. Tente novamente em instantes.";
  return "Nao foi possivel ler a ficha agora. Tente novamente.";
}

function geminiErrorDetail(detail: string) {
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

function configuredGeminiModel(configuredModel: string) {
  const configured = configuredModel.trim().replace(/^models\//, "");
  return configured || "auto";
}

function normalizeImageMimeType(type: string) {
  if (type === "image/jpg") return "image/jpeg";
  return type;
}

async function listGeminiModels(apiKey: string) {
  const endpointVersions = ["v1beta", "v1"];
  const errors: string[] = [];
  for (const version of endpointVersions) {
    const response = await fetch(`https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`);
    if (!response.ok) {
      const detail = await response.text();
      errors.push(`${version}: ${response.status}`);
      console.error("listGeminiModels", { version, status: response.status, detail: detail.slice(0, 500) });
      continue;
    }
    const payload = await response.json();
    const models = Array.isArray(payload.models) ? payload.models : [];
    const names = models
      .filter((item: { supportedGenerationMethods?: string[] }) => item.supportedGenerationMethods?.includes("generateContent"))
      .map((item: { name?: string }) => item.name?.replace(/^models\//, ""))
      .filter((name: unknown): name is string => typeof name === "string" && name.length > 0);
    if (names.length > 0) return { ok: true as const, version, models: names, message: "" };
  }
  return { ok: false as const, version: "", models: [], message: `A chave Gemini nao listou modelos disponiveis. Retornos: ${errors.join(", ") || "sem detalhes"}.` };
}

function chooseGeminiModels(configuredModel: string, availableModels: string[]) {
  const configured = configuredGeminiModel(configuredModel);
  const preferred = ["gemini-2.0-flash-001", "gemini-2.0-flash-lite-001", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];
  const ordered = [
    ...(configured !== "auto" && availableModels.includes(configured) ? [configured] : []),
    ...preferred.filter((name) => availableModels.includes(name)),
    ...availableModels.filter((name) => /flash/i.test(name)),
    ...availableModels,
  ];
  return Array.from(new Set(ordered)).filter(Boolean);
}

function geminiEndpointVersions(preferredVersion: string) {
  return Array.from(new Set([preferredVersion, "v1beta", "v1"].filter(Boolean)));
}
