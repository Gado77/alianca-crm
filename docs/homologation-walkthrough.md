# Walkthrough de Homologacao Supabase - Alianca CRM

Data: 2026-07-15

## 1. Projeto Supabase utilizado

- Ambiente utilizado: Supabase local exclusivo de homologacao.
- URL local: `http://127.0.0.1:54321`.
- Nenhuma chave foi registrada neste documento.
- Nao foi utilizado banco de producao.
- Nao foram inseridos dados reais de clientes.

## 2. Migracao aplicada

- Arquivo: `supabase/migrations/20260715120000_persistence_auth_permissions_audit.sql`.
- Aplicacao final: `npx supabase db reset`.
- Resultado: migracao aplicada com sucesso em banco limpo.
- Observacao: os avisos de `drop trigger/policy ... does not exist` ocorreram por ser primeira aplicacao em schema limpo.

## 3. Estrutura criada

- Enums: 9.
- Tabelas: 11.
- Indices: 39.
- Funcoes: 18.
- Triggers: 17.
- Policies: 29.
- Tabelas com RLS ativo: 11/11.
- Policies para `anon`: 0.
- Funcoes `security definer` sem `search_path`: 0.

Enums criados:

- `follow_up_priority`
- `follow_up_status`
- `lead_source`
- `lead_status`
- `lead_temperature`
- `payment_method`
- `simulation_result`
- `timeline_event_type`
- `user_role`

Tabelas criadas:

- `activity_logs`
- `banks`
- `follow_ups`
- `lead_interests`
- `lead_notes`
- `lead_status_history`
- `lead_timeline_events`
- `leads`
- `profiles`
- `settings`
- `simulations`

## 4. Usuarios ficticios criados

- `admin.20260715175240@homologacao.local` com role `admin`.
- `vendedor1.20260715175240@homologacao.local` com role `vendedor`.
- `vendedor2.20260715175240@homologacao.local` com role `vendedor`.

As senhas foram geradas somente no processo de teste e nao foram gravadas no relatorio.

## 5. Dados ficticios inseridos

Bancos:

- Banco PAN
- Banco BV
- Santander
- Outro

Leads ficticios:

- 5 leads de homologacao, distribuidos entre os dois vendedores.
- CPFs e telefones ficticios.
- CPFs normalizados para 11 digitos.
- Telefones normalizados para 10-13 digitos.

## 6. Resultado dos testes de RLS

Todos passaram:

- Admin visualiza todos os 5 leads.
- Vendedor 1 visualiza somente seus 2 leads atribuidos.
- Vendedor 2 visualiza somente seus 3 leads atribuidos.
- Vendedor nao acessa lead de outro vendedor por consulta direta ao ID.
- Vendedor nao altera responsavel.
- Vendedor nao ativa/desativa lead.
- Vendedor nao marca lead como perdido.
- Vendedor nao corrige simulacao.
- Usuario desativado nao acessa registros.
- Usuario nao autenticado nao acessa tabelas.
- Admin executa acao administrativa de banco.

## 7. Resultado dos testes de triggers

Todos passaram:

- Criacao de lead gerou timeline.
- Simulacao negada exige motivo.
- Simulacao com banco, codigo e resposta do banco foi persistida.
- Simulacao negada criou follow-up automatico.
- Conclusao de follow-up foi persistida.
- Adiamento de follow-up foi persistido.
- Alteracao de status gerou historico.
- Mudanca de responsavel gerou timeline.
- Lead perdido gerou evento proprio.
- Venda finalizada gerou evento proprio.
- Observacao gerou evento proprio.
- Nao houve recursao observada.

## 8. Eventos gerados na timeline

Contagem final:

- `lead_created`: 5
- `status_changed`: 2
- `assigned_user_changed`: 1
- `simulation_created`: 1
- `follow_up_scheduled`: 2
- `follow_up_completed`: 1
- `follow_up_postponed`: 1
- `note_added`: 1
- `lead_lost`: 1
- `sale_finished`: 1

Validacoes adicionais:

- Nao houve evento generico `Lead editado`.
- Simulacao criou apenas um evento consolidado `simulation_created`.
- Logs de atividade nao continham nomes de campos sensiveis como CPF, telefone, data de nascimento ou tokens.
- Eventos duplicados nao foram observados no fluxo testado.

## 9. Erros encontrados

Durante a homologacao foram encontrados e corrigidos:

- Ausencia de `GRANT`s para `authenticated` e `service_role`, impedindo acesso REST mesmo com RLS.
- `can_access_lead` e policy direta de leads nao bloqueavam usuario desativado em todos os caminhos.
- Seed de bancos nao correspondia exatamente ao conjunto solicitado.
- Simulacao negada nao criava follow-up automatico.
- Triggers chamavam `add_timeline_event` com literais `text` sem cast para `timeline_event_type`.
- Trigger de follow-up passava enum para `add_activity_log`, que espera `text`.
- Script de homologacao foi ajustado para reconhecer bloqueio por RLS com zero linhas afetadas.

## 10. Correcoes aplicadas

- Adicionados grants explicitos para `authenticated` e `service_role`.
- Mantido `anon` sem privilegios/policies.
- Reforcada verificacao de usuario ativo em `can_access_lead`.
- Reforcadas policies de select/update de leads com `is_active_user()`.
- Ajustados seeds para Banco PAN, Banco BV, Santander e Outro.
- Implementado follow-up automatico para simulacao negada.
- Adicionados casts explicitos para `public.timeline_event_type`.
- Corrigido cast de `event_name::text` no log de follow-up.
- Criado script `scripts/homologation-validate.mjs`.
- Gerado relatorio JSON em `docs/homologation-test-results.json`.

## 11. Build final

- Comando: `npm run build`.
- Resultado: sucesso.
- Rota `/`: 83.5 kB, First Load JS 186 kB.
- Varredura do bundle `.next/static`, `.next/server` e `src`: nenhum vazamento de `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `sb_secret_`, `localStorage` ou `sessionStorage`.
- `.env.local` confirmado como ignorado pelo Git.

## 12. Recomendacao

Pode prosseguir para a integracao completa do frontend com Supabase em ambiente de homologacao.

Ainda nao recomendo producao. O proximo passo deve ser conectar o frontend ao projeto de homologacao, repetir os fluxos pela interface e manter os testes por sessao autenticada como suite de regressao antes de qualquer aplicacao no ambiente real.
