import { z } from "zod";

export const leadSchema = z.object({
  fullName: z.string().min(3, "Informe o nome completo"),
  cpf: z.string().min(11, "Informe o CPF"),
  phone: z.string().min(10, "Informe o telefone"),
  city: z.string().min(2, "Informe a cidade"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  birthDate: z.string().optional(),
  hasCnh: z.preprocess((value) => value === true || value === "true" || value === "on", z.boolean()),
  cnhCategory: z.enum(["A", "AB", "Não possui"]),
  model: z.enum(["AZ1", "AZ125", "AZ160 Xtreme"]),
  desiredColor: z.string().optional(),
  downPayment: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(["Financiamento", "Cartão", "À vista", "Consórcio", "Outro"]),
  paymentMethodOther: z.string().optional(),
  seller: z.string().min(2, "Informe o vendedor"),
  notes: z.string().optional(),
});

export const simulationSchema = z.object({
  leadId: z.string(),
  bank: z.string().min(2, "Informe o banco"),
  result: z.enum(["Aprovado", "Negado", "Pendente"]),
  downPayment: z.coerce.number().min(0),
  denialReason: z.string().optional(),
  otherReason: z.string().optional(),
  nextActionDate: z.string().optional(),
  notes: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadSchema>;
export type LeadFormInput = z.input<typeof leadSchema>;
export type SimulationFormValues = z.infer<typeof simulationSchema>;
