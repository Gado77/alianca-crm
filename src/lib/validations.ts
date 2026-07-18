import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Informe um email válido"),
  password: z.string().min(6, "Informe a senha"),
});

export const leadCreateSchema = z.object({
  full_name: z.string().min(3, "Informe o nome completo"),
  cpf: z.string().min(11, "Informe o CPF"),
  phone: z.string().min(10, "Informe o telefone"),
  city: z.string().min(2, "Informe a cidade"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  has_driver_license: z.coerce.boolean().optional(),
  license_category: z.enum(["a", "ab", "nao_possui"]).default("nao_possui"),
  motorcycle_model: z.string().min(2, "Informe o modelo"),
  desired_color: z.string().optional(),
  intended_down_payment: z.coerce.number().min(0).optional(),
  payment_method: z.enum(["financiamento", "cartao", "a_vista", "consorcio", "outro"]).default("financiamento"),
  other_payment_method: z.string().optional(),
  assigned_user_id: z.string().uuid().optional().or(z.literal("")),
  source: z
    .enum(["instagram", "facebook", "loja", "indicacao", "whatsapp", "evento", "site", "google", "manual", "outro"])
    .default("manual"),
  notes: z.string().optional(),
  duplicate_confirmed: z.coerce.boolean().optional(),
});

export const followUpSchema = z.object({
  lead_id: z.string().uuid(),
  assigned_user_id: z.string().uuid(),
  reason: z.string().min(2, "Informe o motivo"),
  due_at: z.string().min(4, "Informe a data"),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
});

export const simulationSchema = z.object({
  lead_id: z.string().uuid(),
  bank_id: z.string().uuid().optional().or(z.literal("")).or(z.literal("other")),
  other_bank_name: z.string().optional(),
  result: z.enum(["pendente", "aprovado", "negado"]),
  simulation_date: z.string().optional(),
  denial_reason: z.string().optional(),
  bank_response_code: z.string().optional(),
  bank_response: z.string().optional(),
  proposed_down_payment: z.coerce.number().optional(),
  approved_amount: z.coerce.number().optional(),
  installment_count: z.coerce.number().optional(),
  installment_value: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export const simulationUpdateSchema = simulationSchema.extend({
  id: z.string().uuid(),
});

export const bankSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Informe o nome do banco"),
  active: z.coerce.boolean().default(true),
});

export const leadUpdateSchema = z.object({
  lead_id: z.string().uuid(),
  interest_id: z.string().uuid().optional().or(z.literal("")),
  full_name: z.string().min(3, "Informe o nome completo"),
  cpf: z.string().min(11, "Informe o CPF"),
  phone: z.string().min(10, "Informe o telefone"),
  city: z.string().min(2, "Informe a cidade"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  license_category: z.enum(["a", "ab", "nao_possui"]).default("nao_possui"),
  motorcycle_model: z.string().min(2, "Informe o modelo"),
  desired_color: z.string().optional(),
  intended_down_payment: z.coerce.number().min(0).optional(),
  payment_method: z.enum(["financiamento", "cartao", "a_vista", "consorcio", "outro"]).default("financiamento"),
  other_payment_method: z.string().optional(),
  source: z
    .enum(["instagram", "facebook", "loja", "indicacao", "whatsapp", "evento", "site", "google", "manual", "outro"])
    .default("manual"),
});

export const sellerSchema = z.object({
  email: z.string().email("Informe um email válido"),
  password: z.string().min(8, "Senha mínima de 8 caracteres"),
  full_name: z.string().min(3, "Informe o nome"),
  phone: z.string().optional(),
});
