"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, getCurrentSessionProfile } from "@/lib/supabase/server";
import { bankSchema, followUpSchema, leadCreateSchema, leadUpdateSchema, loginSchema, sellerSchema, simulationSchema } from "@/lib/validations";
import { calculateServerOpportunityScore, onlyDigits } from "@/lib/crm";

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

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

export type FichaImportState = ActionState & {
  extracted?: FichaExtractedLead;
};

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function errorState(message: string, fieldErrors?: ActionState["fieldErrors"]): ActionState {
  return { ok: false, message, fieldErrors };
}

function fichaErrorState(message: string): FichaImportState {
  return { ok: false, message };
}

function normalizeFichaLead(raw: Record<string, unknown>): FichaExtractedLead {
  const stringValue = (key: string) => (typeof raw[key] === "string" ? raw[key].trim() : "");
  const cpf = onlyDigits(stringValue("cpf")).slice(0, 11);
  const phone = normalizeFichaPhone(stringValue("phone"));
  const birthDate = normalizeFichaDate(stringValue("birth_date"));
  const paymentMethod = normalizeFichaPayment(stringValue("payment_method"));
  const licenseCategory = normalizeFichaLicense(stringValue("license_category"));
  const downPayment = normalizeFichaMoney(raw.intended_down_payment);
  const model = normalizeFichaModel(stringValue("motorcycle_model"));

  return {
    full_name: stringValue("full_name"),
    cpf,
    phone,
    city: stringValue("city"),
    email: stringValue("email"),
    birth_date: birthDate,
    license_category: licenseCategory,
    motorcycle_model: model,
    desired_color: stringValue("desired_color"),
    intended_down_payment: downPayment,
    payment_method: paymentMethod,
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
    "Existem dois modelos de ficha. O objetivo e entender campos escritos e caixas marcadas.",
    "Leia CPF, telefone, data de nascimento, cidade/localizacao, CNH, modelo, cor, entrada e forma de pagamento.",
    "Considere caixa marcada quando houver X, risco, check ou rabisco dentro/proximo da opcao.",
    "Se financiamento estiver marcado, payment_method deve ser financiamento. Se a vista estiver marcado, a_vista. Se cartao, cartao. Se consorcio, consorcio.",
    "Se Tem habilitacao estiver marcado em Nao, use nao_possui. Se Sim e categoria vazia, use a. Se categoria A e B, use ab.",
    "Nunca invente dado. Se estiver ilegivel, deixe vazio.",
    "CPF e telefone podem vir formatados, mas retorne apenas numeros quando possivel.",
    "birth_date deve vir em YYYY-MM-DD quando a data estiver legivel.",
    "Coloque informacoes extras em notes, como situacao da simulacao, data da ficha, consultor e condicoes de entrada.",
    "Responda somente JSON valido com as chaves: full_name, cpf, phone, city, email, birth_date, license_category, motorcycle_model, desired_color, intended_down_payment, payment_method, other_payment_method, notes.",
  ].join("\n");
}

function fichaResponseSchema() {
  return {
    type: "object",
    properties: {
      full_name: { type: "string" },
      cpf: { type: "string" },
      phone: { type: "string" },
      city: { type: "string" },
      email: { type: "string" },
      birth_date: { type: "string" },
      license_category: { type: "string", enum: ["a", "ab", "nao_possui"] },
      motorcycle_model: { type: "string" },
      desired_color: { type: "string" },
      intended_down_payment: { type: "string" },
      payment_method: { type: "string", enum: ["financiamento", "cartao", "a_vista", "consorcio", "outro"] },
      other_payment_method: { type: "string" },
      notes: { type: "string" },
    },
    required: [
      "full_name",
      "cpf",
      "phone",
      "city",
      "email",
      "birth_date",
      "license_category",
      "motorcycle_model",
      "desired_color",
      "intended_down_payment",
      "payment_method",
      "other_payment_method",
      "notes",
    ],
  };
}

function geminiErrorMessage(status: number, detail: string) {
  const normalized = detail.toLowerCase();
  if (status === 400 && normalized.includes("api key")) return "A chave Gemini parece invalida. Confira GEMINI_API_KEY na Vercel.";
  if (status === 400 && normalized.includes("schema")) return "O Gemini rejeitou o formato estruturado. Tente novamente.";
  if (status === 400) return "O Gemini recusou a imagem ou o modelo configurado. Confira GEMINI_MODEL na Vercel.";
  if (status === 401 || status === 403) return "A chave Gemini nao tem permissao para essa chamada. Confira a chave e restricoes no Google AI Studio.";
  if (status === 404) return "Modelo Gemini nao encontrado. Use gemini-2.5-flash ou gemini-2.5-flash-lite.";
  if (status === 413) return "A foto ficou grande demais para a IA. Tente uma imagem mais leve.";
  if (status === 429) return "Limite gratuito do Gemini atingido agora. Aguarde um pouco e tente novamente.";
  if (status >= 500) return "O Gemini ficou indisponivel no momento. Tente novamente em instantes.";
  return "Nao foi possivel ler a ficha agora. Tente novamente.";
}

function extractJsonText(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

async function requireActiveProfile() {
  const context = await getCurrentSessionProfile();
  if (!context.user || !context.profile?.active) {
    redirect("/login");
  }
  return context;
}

async function requireAdmin() {
  const context = await requireActiveProfile();
  if (context.profile?.role !== "admin") {
    return { ...context, isAdmin: false };
  }
  return { ...context, isAdmin: true };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return errorState("Revise email e senha.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return errorState("Email ou senha inválidos.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.active) {
      await supabase.auth.signOut();
      return errorState("Usuário desativado. Fale com um administrador.");
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/redefinir-senha`,
  });
  return error ? errorState(error.message) : { ok: true, message: "Enviamos as instruções para o email informado." };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") || "");
  if (password.length < 8) return errorState("A senha precisa ter ao menos 8 caracteres.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? errorState(error.message) : { ok: true, message: "Senha atualizada com sucesso." };
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireActiveProfile();
  const raw = formObject(formData);
  const parsed = leadCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return errorState("Revise os dados do lead.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const duplicate = await supabase.rpc("find_potential_duplicate_leads", {
    input_cpf: data.cpf,
    input_phone: data.phone,
  });

  if (!data.duplicate_confirmed && duplicate.data && duplicate.data.length > 0) {
    return errorState("Possível duplicidade encontrada. Confirme para continuar.");
  }

  const assignedUserId =
    profile.role === "admin" && data.assigned_user_id ? data.assigned_user_id : user.id;

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({
      full_name: data.full_name,
      cpf: onlyDigits(data.cpf),
      phone: onlyDigits(data.phone),
      city: data.city,
      email: data.email || null,
      birth_date: data.birth_date || null,
      has_driver_license: data.license_category !== "nao_possui",
      license_category: data.license_category,
      assigned_user_id: assignedUserId,
      source: data.source,
      opportunity_score: calculateServerOpportunityScore({ downPayment: data.intended_down_payment || 0 }),
    })
    .select("id")
    .single();

  if (leadError || !lead) return errorState(leadError?.message || "Não foi possível criar o lead.");

  const { error: interestError } = await supabase.from("lead_interests").insert({
    lead_id: lead.id,
    motorcycle_model: data.motorcycle_model,
    desired_color: data.desired_color || null,
    intended_down_payment: data.intended_down_payment || null,
    payment_method: data.payment_method,
    other_payment_method: data.other_payment_method || null,
  });

  if (data.notes) {
    await supabase.from("lead_notes").insert({
      lead_id: lead.id,
      author_id: user.id,
      content: data.notes,
    });
  }

  if (interestError) return errorState(interestError.message);

  revalidatePath("/", "layout");
  redirect(`/leads/${lead.id}`);
}

export async function extractFichaAction(_prev: FichaImportState, formData: FormData): Promise<FichaImportState> {
  await requireActiveProfile();

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  if (!apiKey) {
    return fichaErrorState("Configure GEMINI_API_KEY no ambiente do servidor para ler fichas por IA.");
  }

  const file = formData.get("ficha");
  if (!(file instanceof File) || file.size === 0) {
    return fichaErrorState("Envie uma foto da ficha.");
  }
  if (!file.type.startsWith("image/")) {
    return fichaErrorState("Envie uma imagem JPG, PNG ou WEBP.");
  }
  if (file.size > 8 * 1024 * 1024) {
    return fichaErrorState("A imagem precisa ter ate 8 MB.");
  }

  try {
    const imageData = Buffer.from(await file.arrayBuffer()).toString("base64");
    const normalizedModel = model.replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent?key=${apiKey}`;
    const baseBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: fichaPrompt() },
            {
              inlineData: {
                mimeType: file.type,
                data: imageData,
              },
            },
          ],
        },
      ],
    };
    const withSchemaBody = {
      ...baseBody,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: fichaResponseSchema(),
      },
    };
    const plainJsonBody = {
      ...baseBody,
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    };

    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withSchemaBody),
    });

    let responseText = "";
    if (!response.ok) {
      responseText = await response.text();
      if (response.status === 400 && responseText.toLowerCase().includes("schema")) {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plainJsonBody),
        });
        responseText = "";
      }
    }

    if (!response.ok) {
      const detail = responseText || await response.text();
      console.error("extractFichaAction.gemini", {
        status: response.status,
        model: normalizedModel,
        detail: detail.slice(0, 500),
      });
      return fichaErrorState(geminiErrorMessage(response.status, detail));
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")?.text;
    if (!text) return fichaErrorState("A leitura nao retornou dados. Tente outra foto.");

    return {
      ok: true,
      message: "Ficha lida pela IA. Confira tudo antes de salvar.",
      extracted: normalizeFichaLead(JSON.parse(extractJsonText(text))),
    };
  } catch (error) {
    console.error("extractFichaAction", error instanceof Error ? error.message : "unknown");
    return fichaErrorState("Nao foi possivel interpretar a ficha. Confira a foto e tente novamente.");
  }
}

export async function updateLeadDetailsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireActiveProfile();
  const parsed = leadUpdateSchema.safeParse(formObject(formData));
  if (!parsed.success) return errorState("Revise os dados do cliente.", parsed.error.flatten().fieldErrors);

  const data = parsed.data;
  const { error: leadError } = await supabase
    .from("leads")
    .update({
      full_name: data.full_name,
      cpf: onlyDigits(data.cpf),
      phone: onlyDigits(data.phone),
      city: data.city,
      email: data.email || null,
      birth_date: data.birth_date || null,
      has_driver_license: data.license_category !== "nao_possui",
      license_category: data.license_category,
      source: data.source,
    })
    .eq("id", data.lead_id);
  if (leadError) return errorState("Não foi possível atualizar o cliente.");

  const interestPayload = {
    motorcycle_model: data.motorcycle_model,
    desired_color: data.desired_color || null,
    intended_down_payment: data.intended_down_payment || null,
    payment_method: data.payment_method,
    other_payment_method: data.payment_method === "outro" ? data.other_payment_method || null : null,
  };
  const query = data.interest_id
    ? supabase.from("lead_interests").update(interestPayload).eq("id", data.interest_id)
    : supabase.from("lead_interests").insert({ ...interestPayload, lead_id: data.lead_id });
  const { error: interestError } = await query;
  if (interestError) return errorState("Cliente atualizado, mas houve erro no interesse da moto.");

  revalidatePath("/", "layout");
  revalidatePath(`/leads/${data.lead_id}`);
  return { ok: true, message: "Dados do cliente atualizados." };
}

export async function updateLeadStatusAction(formData: FormData) {
  const { supabase } = await requireActiveProfile();
  const id = String(formData.get("lead_id"));
  const status = String(formData.get("status"));
  const lostReason = String(formData.get("lost_reason") || "");
  const { error } = await supabase
    .from("leads")
    .update({ status, lost_reason: lostReason || null })
    .eq("id", id);
  if (error) return errorState(error.message);
  revalidatePath("/", "layout");
  revalidatePath(`/leads/${id}`);
  return { ok: true, message: "Status atualizado." };
}

export async function createFollowUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireActiveProfile();
  const parsed = followUpSchema.safeParse(formObject(formData));
  if (!parsed.success) return errorState("Revise o retorno.", parsed.error.flatten().fieldErrors);
  const { error } = await supabase.from("follow_ups").insert(parsed.data);
  if (error) return errorState(error.message);
  revalidatePath("/", "layout");
  return { ok: true, message: "Retorno criado." };
}

export async function completeFollowUpAction(formData: FormData) {
  const { supabase } = await requireActiveProfile();
  const id = String(formData.get("id"));
  const notes = String(formData.get("completion_notes") || "");
  const { error } = await supabase
    .from("follow_ups")
    .update({ status: "concluido", completed_at: new Date().toISOString(), completion_notes: notes || null })
    .eq("id", id);
  if (error) return errorState(error.message);
  revalidatePath("/", "layout");
  return { ok: true, message: "Retorno concluído." };
}

export async function postponeFollowUpAction(formData: FormData) {
  const { supabase } = await requireActiveProfile();
  const id = String(formData.get("id"));
  const dueAt = String(formData.get("due_at"));
  const reason = String(formData.get("reason") || "Retorno adiado");
  const { error } = await supabase
    .from("follow_ups")
    .update({ status: "adiado", due_at: dueAt, reason })
    .eq("id", id);
  if (error) return errorState(error.message);
  revalidatePath("/", "layout");
  return { ok: true, message: "Retorno adiado." };
}

export async function cancelFollowUpAction(formData: FormData) {
  const { supabase } = await requireActiveProfile();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("follow_ups").update({ status: "cancelado" }).eq("id", id);
  if (error) return errorState(error.message);
  revalidatePath("/", "layout");
  return { ok: true, message: "Retorno cancelado." };
}

export async function createSimulationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireActiveProfile();
  const parsed = simulationSchema.safeParse(formObject(formData));
  if (!parsed.success) return errorState("Revise a simulação.", parsed.error.flatten().fieldErrors);
  if (parsed.data.result === "negado" && !parsed.data.denial_reason) {
    return errorState("Informe o motivo da negativa.", { denial_reason: ["Motivo obrigatório"] });
  }
  let bankId = parsed.data.bank_id;
  if (bankId === "other") {
    const bankName = parsed.data.other_bank_name?.trim();
    if (!bankName) return errorState("Informe o nome do banco.");
    const { data: bank, error: bankError } = await supabase
      .from("banks")
      .upsert({ name: bankName, active: true }, { onConflict: "name" })
      .select("id")
      .single();
    if (bankError || !bank) return errorState("Não foi possível cadastrar o banco informado.");
    bankId = bank.id;
  }
  const { other_bank_name: _otherBankName, bank_id: _rawBankId, ...simulation } = parsed.data;
  void _otherBankName;
  void _rawBankId;
  const { error } = await supabase.from("simulations").insert({
    ...simulation,
    bank_id: bankId,
    created_by: user.id,
    simulation_date: parsed.data.simulation_date || new Date().toISOString().slice(0, 10),
  });
  if (error) return errorState(error.message);
  revalidatePath("/", "layout");
  revalidatePath(`/leads/${parsed.data.lead_id}`);
  return { ok: true, message: "Simulação registrada." };
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireActiveProfile();
  const leadId = String(formData.get("lead_id"));
  const content = String(formData.get("content") || "");
  if (content.trim().length < 2) return errorState("Escreva a observação.");
  const { error } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    author_id: user.id,
    content,
  });
  if (error) return errorState(error.message);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "Observação criada." };
}

export async function registerWhatsappAction(formData: FormData) {
  const { supabase } = await requireActiveProfile();
  const leadId = String(formData.get("lead_id"));
  await supabase.from("lead_timeline_events").insert({
    lead_id: leadId,
    event_type: "whatsapp_opened",
    title: "WhatsApp aberto",
    description: "Atendimento continuado pelo WhatsApp.",
  });
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "WhatsApp registrado." };
}

export async function markContactCompletedAction(formData: FormData) {
  const { supabase } = await requireActiveProfile();
  const leadId = String(formData.get("lead_id"));
  const now = new Date().toISOString();

  const { error: leadError } = await supabase.from("leads").update({ last_contact_at: now }).eq("id", leadId);
  if (leadError) {
    console.error("markContactCompletedAction", leadError.message);
    return;
  }

  const { error: timelineError } = await supabase.from("lead_timeline_events").insert({
    lead_id: leadId,
    event_type: "contact_completed",
    title: "Contato realizado",
    description: "Atendimento marcado como realizado.",
  });
  if (timelineError) console.error("markContactCompletedAction.timeline", timelineError.message);

  revalidatePath("/", "layout");
  revalidatePath(`/leads/${leadId}`);
}

export async function saveBankAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireAdmin();
  if (!context.isAdmin) return errorState("Apenas administradores podem gerenciar bancos.");
  const parsed = bankSchema.safeParse(formObject(formData));
  if (!parsed.success) return errorState("Revise o banco.", parsed.error.flatten().fieldErrors);
  const { id, ...bank } = parsed.data;
  const query = id
    ? context.supabase.from("banks").update(bank).eq("id", id)
    : context.supabase.from("banks").insert(bank);
  const { error } = await query;
  if (error) return errorState(error.message);
  revalidatePath("/bancos");
  return { ok: true, message: "Banco salvo." };
}

export async function deleteBankAction(formData: FormData) {
  const context = await requireAdmin();
  if (!context.isAdmin) return;
  const id = String(formData.get("id"));
  const { error } = await context.supabase.from("banks").delete().eq("id", id);
  if (error) console.error("deleteBankAction", error.message);
  revalidatePath("/bancos");
}

export async function createSellerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireAdmin();
  if (!context.isAdmin) return errorState("Apenas administradores podem criar usuários.");
  const parsed = sellerSchema.safeParse(formObject(formData));
  if (!parsed.success) return errorState("Revise o vendedor.", parsed.error.flatten().fieldErrors);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (error || !data.user) return errorState(error?.message || "Não foi possível criar usuário.");

  const { error: profileError } = await context.supabase.from("profiles").insert({
    id: data.user.id,
    full_name: parsed.data.full_name,
    phone: parsed.data.phone || null,
    role: "vendedor",
    active: true,
  });
  if (profileError) return errorState(profileError.message);
  revalidatePath("/usuarios");
  return { ok: true, message: "Vendedor criado." };
}

export async function toggleUserActiveAction(formData: FormData) {
  const context = await requireAdmin();
  if (!context.isAdmin) return errorState("Apenas administradores podem alterar usuários.");
  const id = String(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  const { error } = await context.supabase.from("profiles").update({ active }).eq("id", id);
  if (error) return errorState(error.message);
  revalidatePath("/usuarios");
  return { ok: true, message: "Usuário atualizado." };
}
export async function createLeadFormAction(formData: FormData) {
  await createLeadAction({ ok: false, message: "" }, formData);
}

export async function updateLeadDetailsFormAction(formData: FormData) {
  await updateLeadDetailsAction({ ok: false, message: "" }, formData);
}

export async function updateLeadStatusFormAction(formData: FormData) {
  await updateLeadStatusAction(formData);
}

export async function createFollowUpFormAction(formData: FormData) {
  await createFollowUpAction({ ok: false, message: "" }, formData);
}

export async function completeFollowUpFormAction(formData: FormData) {
  await completeFollowUpAction(formData);
}

export async function postponeFollowUpFormAction(formData: FormData) {
  await postponeFollowUpAction(formData);
}

export async function cancelFollowUpFormAction(formData: FormData) {
  await cancelFollowUpAction(formData);
}

export async function createSimulationFormAction(formData: FormData) {
  await createSimulationAction({ ok: false, message: "" }, formData);
}

export async function addNoteFormAction(formData: FormData) {
  await addNoteAction({ ok: false, message: "" }, formData);
}

export async function saveBankFormAction(formData: FormData) {
  await saveBankAction({ ok: false, message: "" }, formData);
}

export async function deleteBankFormAction(formData: FormData) {
  await deleteBankAction(formData);
}

export async function createSellerFormAction(formData: FormData) {
  await createSellerAction({ ok: false, message: "" }, formData);
}

export async function toggleUserActiveFormAction(formData: FormData) {
  await toggleUserActiveAction(formData);
}

async function createHomologationUser(email: string, fullName: string) {
  const admin = createSupabaseAdminClient();
  const password = "Homologacao#2026";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(error?.message || "Unable to create homologation user.");
  return { id: data.user.id, email, fullName, password };
}

export async function seedHomologationAction(_prev: ActionState): Promise<ActionState> {
  void _prev;
  const context = await requireAdmin();
  if (!context.isAdmin) return errorState("Apenas administradores podem executar o seed de homologação.");

  try {
    const runId = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const sellerOne = await createHomologationUser(`vendedor1.${runId}@homologacao.local`, "Vendedor Um Homologação");
    const sellerTwo = await createHomologationUser(`vendedor2.${runId}@homologacao.local`, "Vendedor Dois Homologação");

    const { error: profilesError } = await context.supabase.from("profiles").insert([
      { id: sellerOne.id, full_name: sellerOne.fullName, role: "vendedor", active: true },
      { id: sellerTwo.id, full_name: sellerTwo.fullName, role: "vendedor", active: true },
    ]);
    if (profilesError) return errorState("Não foi possível criar os vendedores fictícios.");

    const bankNames = ["Banco PAN", "Banco BV", "Santander"];
    const { data: banks, error: banksError } = await context.supabase
      .from("banks")
      .upsert(bankNames.map((name) => ({ name, active: true })), { onConflict: "name" })
      .select("id,name");
    if (banksError || !banks?.length) return errorState("Não foi possível preparar os bancos fictícios.");

    const bankByName = new Map(banks.map((bank) => [bank.name, bank.id]));
    const leadRows = [
      { full_name: "Ana Teste Homologação", cpf: "11144477735", phone: "11988887777", city: "São Paulo", assigned_user_id: sellerOne.id, status: "aprovado", opportunity_score: 82, source: "manual" },
      { full_name: "Bruno Teste Homologação", cpf: "22255588846", phone: "21977776666", city: "Rio de Janeiro", assigned_user_id: sellerOne.id, status: "simulacao_realizada", opportunity_score: 58, source: "instagram" },
      { full_name: "Carla Teste Homologação", cpf: "33366699957", phone: "31966665555", city: "Belo Horizonte", assigned_user_id: sellerTwo.id, status: "aguardando_cliente", opportunity_score: 66, source: "whatsapp" },
      { full_name: "Diego Teste Homologação", cpf: "44477711168", phone: "41955554444", city: "Curitiba", assigned_user_id: sellerTwo.id, status: "venda_finalizada", opportunity_score: 95, source: "loja" },
      { full_name: "Elisa Teste Homologação", cpf: "55588822279", phone: "51944443333", city: "Porto Alegre", assigned_user_id: sellerOne.id, status: "novo_lead", opportunity_score: 45, source: "indicacao" },
    ];

    const { data: leads, error: leadsError } = await context.supabase.from("leads").insert(leadRows).select("id,full_name,assigned_user_id");
    if (leadsError || !leads?.length) return errorState("Não foi possível criar os leads fictícios.");

    const models = ["Avelloz AZ1", "Avelloz Sport", "Avelloz City", "Avelloz Pro", "Avelloz Cargo"];
    const { error: interestsError } = await context.supabase.from("lead_interests").insert(
      leads.map((lead, index) => ({
        lead_id: lead.id,
        motorcycle_model: models[index],
        desired_color: index % 2 === 0 ? "Preta" : null,
        intended_down_payment: [2500, 0, 1800, 5000, 900][index],
        payment_method: "financiamento",
      }))
    );
    if (interestsError) return errorState("Não foi possível criar interesses fictícios.");

    const panId = bankByName.get("Banco PAN") || banks[0].id;
    const bvId = bankByName.get("Banco BV") || banks[0].id;
    const now = new Date();
    const future = new Date(now);
    future.setDate(future.getDate() + 3);
    const overdue = new Date(now);
    overdue.setDate(overdue.getDate() - 2);

    const { error: simulationsError } = await context.supabase.from("simulations").insert([
      {
        lead_id: leads[0].id,
        created_by: context.user.id,
        bank_id: panId,
        result: "aprovado",
        approved_amount: 18000,
        installment_count: 36,
        installment_value: 640,
        bank_response_code: "APR-HML",
        bank_response: "Aprovado em homologação.",
      },
      {
        lead_id: leads[1].id,
        created_by: context.user.id,
        bank_id: bvId,
        result: "negado",
        denial_reason: "Score baixo",
        bank_response_code: "NEG-HML",
        bank_response: "Negado em homologação.",
      },
    ]);
    if (simulationsError) return errorState("Não foi possível criar simulações fictícias.");

    const { error: followUpsError } = await context.supabase.from("follow_ups").insert([
      { lead_id: leads[1].id, assigned_user_id: sellerOne.id, reason: "Retorno vencido de homologação", due_at: overdue.toISOString(), priority: "alta" },
      { lead_id: leads[2].id, assigned_user_id: sellerTwo.id, reason: "Retorno futuro de homologação", due_at: future.toISOString(), priority: "media" },
    ]);
    if (followUpsError) return errorState("Não foi possível criar retornos fictícios.");

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Seed criado. Vendedores: ${sellerOne.email} e ${sellerTwo.email}. Senha: ${sellerOne.password}.`,
    };
  } catch (error) {
    console.error("seedHomologationAction", error instanceof Error ? error.message : "unknown");
    return errorState("Não foi possível executar o seed de homologação. Verifique o ambiente e tente novamente.");
  }
}
