"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, getCurrentSessionProfile } from "@/lib/supabase/server";
import { bankSchema, followUpSchema, leadCreateSchema, leadUpdateSchema, loginSchema, sellerSchema, simulationSchema, simulationUpdateSchema } from "@/lib/validations";
import { calculateServerOpportunityScore, onlyDigits } from "@/lib/crm";
import { assistantPriorities, assistantStatuses, type AssistantPlan, type AssistantPlanAction } from "@/lib/assistant";

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function errorState(message: string, fieldErrors?: ActionState["fieldErrors"]): ActionState {
  return { ok: false, message, fieldErrors };
}

function buildLeadNotes(notes?: string, registrationDate?: FormDataEntryValue) {
  const parts = [];
  const date = typeof registrationDate === "string" ? registrationDate.trim() : "";
  if (date) parts.push(`Data da ficha: ${formatDateForNote(date)}`);
  if (notes?.trim()) parts.push(notes.trim());
  return parts.join("\n\n");
}

function formatDateForNote(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formNumber(value: unknown) {
  const raw = formString(value).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function getUninformedBankId() {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("banks")
    .select("id")
    .eq("name", "Banco não informado")
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await admin
    .from("banks")
    .insert({ name: "Banco não informado", active: false })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to create uninformed bank.");
  return data.id as string;
}

async function createSimulationFromFicha(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  leadId: string;
  raw: Record<string, FormDataEntryValue>;
}) {
  const result = formString(input.raw.simulation_result);
  if (!["pendente", "aprovado", "negado"].includes(result)) return;

  const denialReason = formString(input.raw.simulation_denial_reason);
  const notes = formString(input.raw.simulation_notes);
  const bankResponse = notes || (result === "aprovado" ? "Simulação aprovada conforme ficha." : "");
  const simulationDate = formString(input.raw.simulation_date) || new Date().toISOString().slice(0, 10);
  const bankId = await getUninformedBankId();

  const { error } = await input.supabase.from("simulations").insert({
    lead_id: input.leadId,
    created_by: input.userId,
    bank_id: bankId,
    result,
    simulation_date: simulationDate,
    denial_reason: result === "negado" ? denialReason || "Simulação negada conforme ficha" : null,
    bank_response: bankResponse || null,
    installment_count: formNumber(input.raw.installment_count),
    installment_value: formNumber(input.raw.installment_value),
    notes: notes || "Simulação importada da ficha.",
  });
  if (error) throw new Error(error.message);

  const status = result === "aprovado" ? "aprovado" : result === "pendente" ? "aguardando_simulacao" : "simulacao_realizada";
  await input.supabase.from("leads").update({ status }).eq("id", input.leadId);
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

  const leadNotes = buildLeadNotes(data.notes, raw.registration_date);
  if (leadNotes) {
    await supabase.from("lead_notes").insert({
      lead_id: lead.id,
      author_id: user.id,
      content: leadNotes,
    });
  }

  if (interestError) return errorState(interestError.message);

  try {
    await createSimulationFromFicha({ supabase, userId: user.id, leadId: lead.id, raw });
  } catch (error) {
    console.error("createSimulationFromFicha", error instanceof Error ? error.message : "unknown");
    return errorState("Cliente criado, mas não foi possível registrar a simulação lida na ficha.");
  }

  revalidatePath("/", "layout");
  redirect(`/leads/${lead.id}`);
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

export async function archiveLeadAction(formData: FormData) {
  const context = await requireAdmin();
  if (!context.isAdmin) return errorState("Apenas administrador pode excluir cliente.");
  const id = String(formData.get("lead_id"));
  if (String(formData.get("confirm_delete")) !== "true") return errorState("Confirme a exclusão do cliente.");
  const { error } = await context.supabase.from("leads").update({ active: false }).eq("id", id);
  if (error) return errorState("Não foi possível excluir o cliente.");
  revalidatePath("/", "layout");
  redirect("/leads");
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
  let bankId = parsed.data.bank_id || "";
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
  if (!bankId) {
    bankId = await getUninformedBankId();
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

export async function updateSimulationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireAdmin();
  if (!context.isAdmin) return errorState("Apenas administrador pode editar simulação.");
  const parsed = simulationUpdateSchema.safeParse(formObject(formData));
  if (!parsed.success) return errorState("Revise a simulação.", parsed.error.flatten().fieldErrors);
  if (parsed.data.result === "negado" && !parsed.data.denial_reason) {
    return errorState("Informe o motivo da negativa.", { denial_reason: ["Motivo obrigatório"] });
  }
  const bankId = parsed.data.bank_id || await getUninformedBankId();

  const { error } = await context.supabase
    .from("simulations")
    .update({
      bank_id: bankId,
      result: parsed.data.result,
      simulation_date: parsed.data.simulation_date || new Date().toISOString().slice(0, 10),
      denial_reason: parsed.data.result === "negado" ? parsed.data.denial_reason || null : null,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id)
    .eq("lead_id", parsed.data.lead_id);

  if (error) return errorState("Não foi possível editar a simulação.");
  revalidatePath("/", "layout");
  revalidatePath(`/leads/${parsed.data.lead_id}`);
  return { ok: true, message: "Simulação atualizada." };
}

export async function deleteSimulationAction(formData: FormData) {
  const context = await requireAdmin();
  if (!context.isAdmin) return errorState("Apenas administrador pode excluir simulação.");
  const id = String(formData.get("id"));
  const leadId = String(formData.get("lead_id"));
  const { error } = await context.supabase.from("simulations").delete().eq("id", id).eq("lead_id", leadId);
  if (error) return errorState("Não foi possível excluir a simulação.");
  revalidatePath("/", "layout");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "Simulação excluída." };
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

export async function executeAssistantPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireActiveProfile();
  const rawPlan = String(formData.get("plan") || "");
  let plan: AssistantPlan;
  try {
    plan = JSON.parse(rawPlan) as AssistantPlan;
  } catch {
    return errorState("Plano do assistente inválido.");
  }

  const leadId = plan.lead?.id;
  if (!leadId) return errorState("Selecione um cliente antes de confirmar.");

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id,assigned_user_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) return errorState("Cliente não encontrado ou sem permissão.");

  const actions = (plan.actions || []).slice(0, 4);
  if (!actions.length) return errorState("O assistente não montou nenhuma ação para salvar.");

  for (const action of actions) {
    const result = await executeAssistantAction({
      supabase,
      userId: user.id,
      assignedUserId: lead.assigned_user_id || user.id,
      leadId,
      action,
    });
    if (!result.ok) return result;
  }

  revalidatePath("/", "layout");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "Assistente salvou as ações confirmadas." };
}

async function executeAssistantAction(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  assignedUserId: string;
  leadId: string;
  action: AssistantPlanAction;
}): Promise<ActionState> {
  if (input.action.type === "note") {
    const content = input.action.content?.trim();
    if (!content) return { ok: true, message: "" };
    const { error } = await input.supabase.from("lead_notes").insert({
      lead_id: input.leadId,
      author_id: input.userId,
      content,
    });
    return error ? errorState("Não foi possível salvar a observação.") : { ok: true, message: "" };
  }

  if (input.action.type === "follow_up") {
    const priority = assistantPriorities.includes(input.action.priority) ? input.action.priority : "media";
    const dueAt = new Date(input.action.due_at);
    const { error } = await input.supabase.from("follow_ups").insert({
      lead_id: input.leadId,
      assigned_user_id: input.assignedUserId,
      reason: input.action.reason || input.action.title || "Retorno criado pelo assistente",
      due_at: Number.isFinite(dueAt.getTime()) ? dueAt.toISOString() : new Date(Date.now() + 86400000).toISOString(),
      priority,
    });
    return error ? errorState("Não foi possível criar o lembrete.") : { ok: true, message: "" };
  }

  if (input.action.type === "status") {
    const status = assistantStatuses.includes(input.action.status) ? input.action.status : null;
    if (!status) return { ok: true, message: "" };
    const { error } = await input.supabase
      .from("leads")
      .update({ status, lost_reason: status === "perdido" ? input.action.lost_reason || "Marcado pelo assistente" : null })
      .eq("id", input.leadId);
    return error ? errorState("Não foi possível atualizar o status.") : { ok: true, message: "" };
  }

  return { ok: true, message: "" };
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

export async function archiveLeadFormAction(formData: FormData) {
  await archiveLeadAction(formData);
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

export async function updateSimulationFormAction(formData: FormData) {
  await updateSimulationAction({ ok: false, message: "" }, formData);
}

export async function deleteSimulationFormAction(formData: FormData) {
  await deleteSimulationAction(formData);
}

export async function addNoteFormAction(formData: FormData) {
  await addNoteAction({ ok: false, message: "" }, formData);
}

export async function executeAssistantPlanFormAction(formData: FormData) {
  await executeAssistantPlanAction({ ok: false, message: "" }, formData);
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
