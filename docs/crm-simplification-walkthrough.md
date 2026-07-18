# Walkthrough - limpeza e simplificacao do CRM

Data: 2026-07-17

## Objetivo

Reduzir ruido visual e operacional no Aliança CRM sem alterar banco, migracoes, RLS, autenticacao, auditoria, timeline, triggers, simulacoes, WhatsApp ou persistencia do pipeline.

## Arquivos alterados

- `.env.example`
- `src/app/(crm)/layout.tsx`
- `src/components/app-shell.tsx`
- `src/app/(crm)/page.tsx`
- `src/components/postpone-follow-up.tsx`
- `src/app/(crm)/retornos/page.tsx`
- `src/app/(crm)/leads/[id]/page.tsx`
- `src/app/(crm)/leads/importar/page.tsx`
- `src/app/(crm)/leads/page.tsx`
- `src/app/(crm)/leads/novo/page.tsx`
- `src/app/(crm)/estatisticas/page.tsx`
- `src/app/actions.ts`
- `src/components/lead-create-panel.tsx`
- `src/components/pipeline-board.tsx`
- `src/lib/crm.ts`

## Mudancas realizadas

- Troquei textos visiveis de "Lead/Leads" para "Cliente/Clientes" nas telas operacionais, mantendo nomes tecnicos internos como `lead`, rotas `/leads` e tabelas intactos.
- Simplifiquei a tela Hoje para uma fila unica chamada "Prioridades de hoje", com indicadores pequenos de atrasados, hoje e simulacoes pendentes.
- A fila de Hoje agora prioriza retornos atrasados, retornos de hoje, simulacoes pendentes e clientes sem contato recente e sem proxima acao.
- Criei o componente reutilizavel `PostponeFollowUp`, com opcoes Amanhã, Em 3 dias, Proxima semana e Escolher data.
- Usei o novo seletor de adiamento na tela Hoje, na Central de Retornos e no card de proxima acao da pagina do cliente.
- Desativei o Assistente do CRM por padrao via `NEXT_PUBLIC_ENABLE_CRM_ASSISTANT=false`.
- Removi Configuracoes da navegacao desktop e mobile, mantendo a rota direta existente.
- Reorganizei a navegacao para concentrar a rotina diaria em Hoje, Clientes, Retornos e Funil, deixando administracao em area secundaria.
- Reduzi o Resumo mensal para cinco indicadores e uma lista simples de motivos de negativa.
- Tornei o Resumo mensal visivel apenas para administrador.
- Na pagina do cliente, deixei os formularios de nova simulacao, editar cliente, alterar status, criar retorno e adicionar observacao recolhidos por padrao.
- Protegi a rota de importacao de ficha no servidor para administrador, alem de esconder o link para vendedores.
- Ajustei a importacao de ficha para usar linguagem de teste e reforcar que a leitura pode conter erros antes de salvar.
- Corrigi texto quebrado por encoding no card do Funil.

## Recursos ocultados

- Assistente do CRM: oculto por padrao e renderizado somente quando `NEXT_PUBLIC_ENABLE_CRM_ASSISTANT=true`.
- Configuracoes: removida dos menus, mas a rota `/configuracoes` continua existindo.
- Importar ficha: oculto para vendedor e protegido no servidor para admin.
- Resumo mensal: oculto para vendedor e protegido no servidor para admin.
- Formulario completo de simulacao e formularios da aba Mais: continuam disponiveis, mas fechados por padrao.

## Flags adicionadas

- `NEXT_PUBLIC_ENABLE_CRM_ASSISTANT=false`

Essa flag fica no `.env.example`. O assistente so aparece quando o valor for exatamente `true`.

## Consultas de dados

Mantive `getLeadCollections()` nas telas principais. A separacao em consultas especificas (`getTodayQueue`, `getReturns`, `getMonthlySummary`) foi documentada como oportunidade futura porque exigiria uma mudanca maior na camada de dados e poderia afetar RLS/isolamento sem ganho suficiente nesta etapa.

## Permissoes revisadas

- Vendedor nao ve o link de Importar ficha.
- Vendedor recebe `notFound()` ao tentar acessar `/leads/importar` diretamente.
- Vendedor nao acessa Resumo mensal.
- Administrador continua vendo Importar ficha, Resumo mensal, Equipe, Bancos e Homologacao quando permitido.
- Configuracoes nao aparece mais no menu.

## Validacao executada

- `npm install`: concluido com sucesso. O npm informou 2 vulnerabilidades moderadas; nao rodei `npm audit fix --force` porque pode alterar dependencias fora do escopo.
- `npm run lint`: concluido com sucesso.
- `npm run build`: concluido com sucesso no Next.js 15.5.20.

## Limitacoes restantes

- Ainda falta teste manual completo em celular real nos tamanhos 320px, 375px, 390px e 430px.
- Ainda falta validar visualmente safe-area, barra inferior, FAB, menu Mais e formularios expansivos em dispositivo real.
- Ainda falta regressao manual com usuarios admin e vendedor no Supabase de homologacao.
- As consultas continuam amplas em algumas telas; a otimizacao deve ser feita em uma tarefa propria para reduzir risco.
- A rota `/configuracoes` segue acessivel por URL direta, conforme solicitado para nao apagar funcionalidade.

## Recomendacao

Prosseguir para homologacao manual da interface antes de qualquer push/deploy. A entrega esta localmente consistente, mas depende de validacao real de permissao, mobile e fluxos de retorno/simulacao.
