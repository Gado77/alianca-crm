import { onlyDigits } from "@/lib/crm";

export type FichaExtractedLead = {
  full_name: string;
  cpf: string;
  phone: string;
  city: string;
  email: string;
  birth_date: string;
  registration_date: string;
  license_category: "a" | "ab" | "nao_possui";
  motorcycle_model: string;
  desired_color: string;
  intended_down_payment: number | "";
  payment_method: "financiamento" | "cartao" | "a_vista" | "consorcio" | "outro";
  other_payment_method: string;
  simulation_result: "none" | "pendente" | "aprovado" | "negado";
  simulation_date: string;
  simulation_denial_reason: string;
  simulation_notes: string;
  installment_count: number | "";
  installment_value: number | "";
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
  const model = process.env.GROQ_MODEL || "qwen/qwen3.6-27b";
  if (!apiKey) return { ok: false, message: "Configure GROQ_API_KEY no ambiente do servidor para ler fichas por IA." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Envie uma imagem JPG, PNG ou WEBP." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, message: "A imagem precisa ter ate 3 MB." };

  try {
    const imageData = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = normalizeImageMimeType(file.type);
    const models = groqVisionModels(model);
    let lastError: { status: number; detail: string; model: string } | null = null;
    let lastParseError = false;

    for (const currentModel of models) {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: currentModel,
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
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error("extractFichaWithGroq", {
          status: response.status,
          model: currentModel,
          detail: detail.slice(0, 500),
        });
        lastError = { status: response.status, detail, model: currentModel };
        if (response.status === 404) continue;
        return { ok: false, message: await groqErrorMessage(apiKey, response.status, detail) };
      }

      const payload = await response.json();
      const text = payload?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) {
        return { ok: false, message: "A Groq nao retornou dados da ficha. Tente outra foto." };
      }

      try {
        const parsed = await parseFichaJsonWithRepair({ apiKey, model: currentModel, text });
        return {
          ok: true,
          message: `Ficha lida pela IA Groq (${currentModel}). Confira tudo antes de salvar.`,
          extracted: normalizeFichaLead(parsed),
        };
      } catch (error) {
        console.error("extractFichaWithGroq.parse", error instanceof Error ? error.message : "unknown");
        lastParseError = true;
      }
    }

    if (lastError) {
      return { ok: false, message: await groqErrorMessage(apiKey, lastError.status, lastError.detail) };
    }

    if (lastParseError) {
      return { ok: false, message: "A IA leu a ficha, mas respondeu fora do formato esperado. Tente novamente com a foto mais centralizada e nítida." };
    }

    return { ok: false, message: "Nenhum modelo Groq ficou disponivel para ler a ficha agora." };
  } catch (error) {
    console.error("extractFichaWithGroq", error instanceof Error ? error.message : "unknown");
    return { ok: false, message: "Nao foi possivel interpretar a ficha. Confira a foto e tente novamente." };
  }
}

function groqVisionModels(configuredModel: string) {
  return Array.from(new Set([
    configuredModel,
    "qwen/qwen3.6-27b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
  ].filter(Boolean)));
}

function normalizeFichaLead(raw: Record<string, unknown>): FichaExtractedLead {
  const stringValue = (key: string) => (typeof raw[key] === "string" ? raw[key].trim() : "");
  return {
    full_name: stringValue("full_name"),
    cpf: onlyDigits(stringValue("cpf")).slice(0, 11),
    phone: normalizeFichaPhone(stringValue("phone")),
    city: normalizeFichaCity(stringValue("city"), stringValue("location_detail")),
    email: stringValue("email"),
    birth_date: normalizeFichaDate(stringValue("birth_date")),
    registration_date: normalizeFichaDate(stringValue("registration_date")),
    license_category: normalizeFichaLicense(stringValue("license_category")),
    motorcycle_model: normalizeFichaModel(stringValue("motorcycle_model")),
    desired_color: stringValue("desired_color"),
    intended_down_payment: normalizeFichaMoney(raw.intended_down_payment),
    payment_method: normalizeFichaPayment(stringValue("payment_method")),
    other_payment_method: stringValue("other_payment_method"),
    simulation_result: normalizeFichaSimulationResult(stringValue("simulation_result"), raw),
    simulation_date: normalizeFichaDate(stringValue("simulation_date")) || normalizeFichaDate(stringValue("registration_date")),
    simulation_denial_reason: normalizeFichaDenialReason(stringValue("simulation_denial_reason"), stringValue("simulation_notes")),
    simulation_notes: stringValue("simulation_notes"),
    installment_count: normalizeFichaInteger(raw.installment_count),
    installment_value: normalizeFichaMoney(raw.installment_value),
    notes: normalizeFichaNotes(raw),
  };
}

function normalizeFichaPhone(value: string) {
  const digits = onlyDigits(value);
  if (digits.startsWith("55") && digits.length > 11) return digits.slice(2, 13);
  return digits.slice(0, 11);
}

function normalizeFichaCity(city: string, locationDetail: string) {
  const cleanCity = city.trim();
  const cleanLocation = locationDetail.trim();
  if (!cleanLocation) return cleanCity;
  if (!cleanCity) return cleanLocation;
  if (cleanCity.toLowerCase().includes(cleanLocation.toLowerCase())) return cleanCity;
  return `${cleanCity} - ${cleanLocation}`;
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
  if (!normalized || normalized.includes("nao") || normalized.includes("não") || normalized.includes("sem marc")) return "nao_possui";
  if (normalized.includes("ab") || normalized.includes("a e b")) return "ab";
  if (normalized === "a" || normalized.includes("categoria a")) return "a";
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

function normalizeFichaSimulationResult(value: string, raw: Record<string, unknown>): FichaExtractedLead["simulation_result"] {
  const haystack = [
    value,
    stringValue(raw.simulation_denial_reason),
    stringValue(raw.simulation_notes),
    stringValue(raw.notes),
    stringValue(raw.loose_notes),
  ].join(" ").toLowerCase();
  if (!haystack.trim()) return "none";
  if (haystack.includes("aprov")) return "aprovado";
  if (haystack.includes("pend")) return "pendente";
  if (haystack.includes("neg") || haystack.includes("recus") || haystack.includes("ineleg") || haystack.includes("score") || haystack.includes("restri")) {
    return "negado";
  }
  return value === "pendente" || value === "aprovado" || value === "negado" ? value : "none";
}

function normalizeFichaDenialReason(reason: string, notes: string) {
  const value = `${reason} ${notes}`.toLowerCase();
  if (value.includes("ineleg")) return "Cliente inelegivel";
  if (value.includes("score")) return "Score baixo";
  if (value.includes("restri") || value.includes("dívida") || value.includes("divida")) return "Nome restrito";
  if (value.includes("entrada")) return "Sem entrada";
  if (value.includes("sal")) return "Aguardando salario";
  return reason;
}

function normalizeFichaMoney(value: unknown): number | "" {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return "";
  const digits = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "";
}

function normalizeFichaInteger(value: unknown): number | "" {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return "";
  const parsed = Number(onlyDigits(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : "";
}

function normalizeFichaModel(value: string) {
  const normalized = value.toUpperCase().replace(/\s+/g, " ").trim();
  if (normalized.includes("160")) return "AZ 160 X-TREME";
  if (normalized.includes("125")) return "AZ125-ALFA";
  if (normalized.includes("AZ1")) return "AZ1";
  return value;
}

function normalizeFichaNotes(raw: Record<string, unknown>) {
  const parts = [
    stringValue(raw.notes),
    stringValue(raw.location_detail) ? `Interior/localidade: ${stringValue(raw.location_detail)}` : "",
    stringValue(raw.loose_notes),
    stringValue(raw.uncertainty_notes) ? `Conferir leitura: ${stringValue(raw.uncertainty_notes)}` : "",
  ].filter(Boolean);
  return Array.from(new Set(parts)).join("\n");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fichaPrompt() {
  return [
    "Extraia os dados desta ficha manuscrita da Alianca Motos para cadastro de lead.",
    "Leia campos escritos e caixas marcadas. Considere caixa marcada quando houver X, risco, check ou rabisco dentro/proximo da opcao.",
    "Nunca invente dado. Se estiver ilegivel ou sem marcacao clara, deixe vazio ou use nao_possui quando for CNH.",
    "CPF deve ter 11 digitos e telefone deve ter DDD mais numero com 10 ou 11 digitos. Nao corrija por chute; se houver duvida, registre em uncertainty_notes.",
    "CNH: se a caixa SIM ou categoria nao estiver claramente marcada, retorne license_category como nao_possui. Se a caixa NAO estiver marcada, tambem retorne nao_possui.",
    "Cidade: se a ficha tiver Localizacao impressa como Sao Jose do Piaui, use city como Sao Jose do Piaui. Se houver nome de interior/povoado/comunidade escrito em Cidade/Estado ou em outro lugar, coloque esse nome em location_detail.",
    "Observacoes: capture qualquer anotacao solta no papel, mesmo fora do campo Observacoes, como parcelas, condicoes, entrada, '10x784' ou recados, em loose_notes.",
    "Situacao da simulacao: se houver campo/caixa marcado como financiamento aprovado, cliente nao elegivel, proposta recusada, pendente, score baixo ou anotacao de simulacao nas observacoes, extraia para simulation_result, simulation_denial_reason e simulation_notes.",
    "Se a simulacao estiver aprovada, simulation_result deve ser aprovado. Se cliente nao elegivel, proposta recusada, score baixo ou nome restrito, simulation_result deve ser negado. Se nao houver simulacao na ficha, use simulation_result none.",
    "Se houver parcela anotada como 10x784, coloque installment_count 10 e installment_value 784, e tambem preserve a anotacao em loose_notes.",
    "Data do cadastro deve ir em registration_date no formato AAAA-MM-DD quando existir.",
    "Retorne somente JSON valido com as chaves: full_name, cpf, phone, city, location_detail, email, birth_date, registration_date, license_category, motorcycle_model, desired_color, intended_down_payment, payment_method, other_payment_method, simulation_result, simulation_date, simulation_denial_reason, simulation_notes, installment_count, installment_value, notes, loose_notes, uncertainty_notes.",
    "license_category deve ser a, ab ou nao_possui. payment_method deve ser financiamento, cartao, a_vista, consorcio ou outro.",
  ].join("\n");
}

async function groqErrorMessage(apiKey: string, status: number, detail: string) {
  const parsedDetail = providerErrorDetail(detail);
  if (status === 400) return `A Groq recusou a imagem ou a chamada. ${parsedDetail ? `Detalhe: ${parsedDetail}` : "Tente outra foto ou confira GROQ_MODEL na Vercel."}`;
  if (status === 401 || status === 403) return "A chave Groq nao tem permissao para essa chamada. Confira GROQ_API_KEY na Vercel.";
  if (status === 404) {
    const availableModels = await listGroqModels(apiKey);
    const modelList = availableModels.length ? ` Modelos visiveis nessa chave: ${availableModels.slice(0, 12).join(", ")}.` : "";
    return `Modelo de visao da Groq nao encontrado nessa chave. Ative/libere qwen/qwen3.6-27b no projeto da Groq ou crie uma nova chave no projeto correto.${modelList}`;
  }
  if (status === 413) return "A foto ficou grande demais para a Groq. Tente uma imagem mais leve.";
  if (status === 429) return "A Groq bloqueou por limite de uso agora. Aguarde um pouco e tente novamente.";
  if (status >= 500) return "A Groq ficou indisponivel no momento. Tente novamente em instantes.";
  return "Nao foi possivel ler a ficha agora. Tente novamente.";
}

async function listGroqModels(apiKey: string) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const models: Array<{ id?: unknown }> = Array.isArray(payload?.data) ? payload.data : [];
    return models.map((item) => item?.id).filter((id): id is string => typeof id === "string").sort();
  } catch (error) {
    console.error("listGroqModels", error instanceof Error ? error.message : "unknown");
    return [];
  }
}

function providerErrorDetail(detail: string) {
  try {
    const parsed = JSON.parse(detail) as { error?: { message?: string } };
    return parsed.error?.message?.replace(/\s+/g, " ").slice(0, 180) || "";
  } catch {
    return detail.replace(/\s+/g, " ").slice(0, 180);
  }
}

async function parseFichaJsonWithRepair({ apiKey, model, text }: { apiKey: string; model: string; text: string }) {
  try {
    return parseFichaJson(text);
  } catch {
    const repaired = await repairFichaJson({ apiKey, model, text });
    return parseFichaJson(repaired);
  }
}

async function repairFichaJson({ apiKey, model, text }: { apiKey: string; model: string; text: string }) {
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
            "Converta o texto abaixo para JSON valido e estrito.",
            "Nao invente dados. Use string vazia quando faltar valor.",
            "Retorne somente o objeto JSON, sem markdown.",
            "Chaves obrigatorias: full_name, cpf, phone, city, location_detail, email, birth_date, registration_date, license_category, motorcycle_model, desired_color, intended_down_payment, payment_method, other_payment_method, simulation_result, simulation_date, simulation_denial_reason, simulation_notes, installment_count, installment_value, notes, loose_notes, uncertainty_notes.",
            "Texto:",
            text.slice(0, 6000),
          ].join("\n"),
        },
      ],
      temperature: 0,
      max_completion_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq JSON repair failed: ${response.status} ${providerErrorDetail(detail)}`);
  }

  const payload = await response.json();
  const repaired = payload?.choices?.[0]?.message?.content;
  if (typeof repaired !== "string" || !repaired.trim()) {
    throw new Error("Groq JSON repair returned empty response.");
  }
  return repaired;
}

function parseFichaJson(text: string) {
  try {
    return JSON.parse(extractJsonText(text)) as Record<string, unknown>;
  } catch {
    throw new Error("Groq returned invalid ficha JSON.");
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
