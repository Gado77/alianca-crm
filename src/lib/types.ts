export type LeadStatus =
  | "Novo Lead"
  | "Aguardando Simulação"
  | "Simulação Realizada"
  | "Aguardando Cliente"
  | "Aprovado"
  | "Documentação"
  | "Venda Finalizada"
  | "Perdido";

export type SimulationResult = "Aprovado" | "Negado" | "Pendente";

export type PaymentMethod =
  | "Financiamento"
  | "Cartão"
  | "À vista"
  | "Consórcio"
  | "Outro";

export type PriorityGroup = "Atenda hoje" | "Responder hoje" | "Acompanhar esta semana";

export type Simulation = {
  id: string;
  date: string;
  bank: string;
  result: SimulationResult;
  downPayment: number;
  denialReason?: string;
  otherReason?: string;
  nextActionDate?: string;
  notes: string;
};

export type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  description: string;
};

export type Lead = {
  id: string;
  fullName: string;
  cpf: string;
  phone: string;
  city: string;
  email?: string;
  birthDate?: string;
  hasCnh: boolean;
  cnhCategory: "A" | "AB" | "Não possui";
  model: "AZ1" | "AZ125" | "AZ160 Xtreme";
  desiredColor?: string;
  downPayment?: number;
  paymentMethod: PaymentMethod;
  paymentMethodOther?: string;
  seller: string;
  status: LeadStatus;
  bank?: string;
  lastResult?: SimulationResult;
  nextActionDate?: string;
  nextActionReason: string;
  notes: string;
  visitedStore: boolean;
  respondsWhatsapp: boolean;
  returnedContact: boolean;
  boughtElsewhere: boolean;
  lastContactDate: string;
  createdAt: string;
  closedAt?: string;
  simulations: Simulation[];
  timeline: TimelineEvent[];
};

export type Activity = {
  id: string;
  time: string;
  type: "simulação" | "aprovação" | "entrada" | "venda";
  leadName: string;
  description: string;
};
