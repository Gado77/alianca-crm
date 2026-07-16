export type HomologationItem = {
  id: string;
  group: string;
  description: string;
  href: string;
};

export const homologationItems: HomologationItem[] = [
  { id: "auth-valid-login", group: "Autenticação", description: "Login válido com usuário ativo.", href: "/login" },
  { id: "auth-invalid-login", group: "Autenticação", description: "Login inválido mostra erro compreensível.", href: "/login" },
  { id: "auth-logout", group: "Autenticação", description: "Logout encerra sessão e volta ao login.", href: "/" },
  { id: "auth-reset", group: "Autenticação", description: "Recuperação de senha abre fluxo sem stack trace.", href: "/recuperar-senha" },
  { id: "auth-inactive", group: "Autenticação", description: "Usuário desativado não acessa rotas protegidas.", href: "/usuarios" },
  { id: "auth-protected-redirect", group: "Autenticação", description: "Rota protegida sem sessão redireciona para login.", href: "/" },
  { id: "mobile-320", group: "Mobile", description: "Viewport 320px: navegação, formulários, cards e safe-area.", href: "/" },
  { id: "mobile-375", group: "Mobile", description: "Viewport 375px: barra inferior fixa e conteúdo não coberto.", href: "/leads" },
  { id: "mobile-390", group: "Mobile", description: "Viewport 390px: botão Mais e menus por permissão.", href: "/retornos" },
  { id: "mobile-430", group: "Mobile", description: "Viewport 430px: Kanban, página do lead e WhatsApp.", href: "/pipeline" },
  { id: "lead-create", group: "Cadastro", description: "Criar lead fictício com campos obrigatórios e prevenção de envio duplo.", href: "/leads" },
  { id: "lead-normalization", group: "Cadastro", description: "CPF e telefone são normalizados após salvar.", href: "/leads" },
  { id: "lead-duplicate", group: "Cadastro", description: "Duplicidade exige confirmação manual.", href: "/leads" },
  { id: "simulation-pending", group: "Simulação", description: "Simulação pendente persiste e aparece na timeline.", href: "/leads" },
  { id: "simulation-approved", group: "Simulação", description: "Simulação aprovada salva resposta e código do banco.", href: "/leads" },
  { id: "simulation-denied-invalid", group: "Simulação", description: "Negada sem motivo deve falhar.", href: "/leads" },
  { id: "simulation-denied-valid", group: "Simulação", description: "Negada com motivo cria follow-up automático sem duplicar timeline.", href: "/leads" },
  { id: "returns-list", group: "Retornos", description: "Listar hoje, atrasados e próximos.", href: "/retornos" },
  { id: "returns-actions", group: "Retornos", description: "Concluir, adiar e cancelar atualizam dashboard.", href: "/retornos" },
  { id: "whatsapp-opened", group: "WhatsApp", description: "Mensagem legível, número correto e evento whatsapp_opened sem dados sensíveis.", href: "/leads" },
  { id: "whatsapp-contact-completed", group: "WhatsApp", description: "Somente Marcar contato como realizado atualiza last_contact_at e registra contact_completed.", href: "/leads" },
  { id: "permissions-admin", group: "Permissões", description: "Admin visualiza tudo e executa ações administrativas.", href: "/usuarios" },
  { id: "permissions-seller-one", group: "Permissões", description: "Vendedor 1 vê apenas seus leads e não altera responsável.", href: "/leads" },
  { id: "permissions-seller-two", group: "Permissões", description: "Vendedor 2 não acessa lead de outro vendedor por URL direta.", href: "/leads" },
  { id: "permissions-restricted-actions", group: "Permissões", description: "Vendedor não marca perdido, corrige simulação ou acessa menus admin.", href: "/pipeline" },
  { id: "pipeline-valid", group: "Pipeline", description: "Transição válida persiste e aparece após reload.", href: "/pipeline" },
  { id: "pipeline-invalid", group: "Pipeline", description: "Transição inválida mostra erro compreensível e rollback visual.", href: "/pipeline" },
  { id: "pipeline-mobile", group: "Pipeline", description: "Seletor mobile atualiza status sem drag-and-drop.", href: "/pipeline" },
];
