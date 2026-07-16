# Publicacao Cloud - Alianca CRM

Este documento prepara a primeira publicacao online do Aliança CRM em ambiente cloud. O ambiente online pode ser usado como homologacao externa, mas tecnicamente deve ser tratado como producao: sem dados reais de clientes ate a validacao final.

## 1. Escopo

- Aplicacao Next.js publicada na Vercel.
- Banco e Auth em um projeto Supabase Cloud novo.
- Dados iniciais apenas ficticios ou administrativos.
- Nenhuma chave ou senha deve ser versionada, enviada em chat ou colocada em bundle cliente.

## 2. Responsabilidades do usuario

- Criar o projeto Supabase Cloud.
- Criar ou informar o repositorio GitHub.
- Conectar o repositorio na Vercel.
- Inserir variaveis de ambiente na Vercel e localmente.
- Criar o primeiro administrador com senha temporaria.
- Executar testes finais antes de cadastrar clientes reais.

## 3. Estado do repositorio

- Git local inicializado.
- Remote GitHub ainda nao configurado no momento desta preparacao.
- `.gitignore` ignora `.env*`, `.vercel`, `node_modules`, `.next` e artefatos de build.
- `.env.example` contem somente nomes de variaveis e valores publicos de exemplo.

## 4. Migracoes que devem ser aplicadas

Aplicar nesta ordem:

```text
supabase/migrations/20260715120000_persistence_auth_permissions_audit.sql
supabase/migrations/20260715183000_contact_completed_timeline.sql
supabase/migrations/20260715190000_remove_other_bank_seed.sql
```

## 5. Metodo A - Supabase SQL Editor

1. Criar projeto Supabase Cloud exclusivo para o Aliança CRM.
2. Abrir `SQL Editor`.
3. Colar e executar a primeira migracao.
4. Repetir para a segunda e terceira migracao, sempre na ordem acima.
5. Salvar o resultado de cada execucao no historico do Supabase.

## 6. Metodo B - Supabase CLI

Use este metodo apenas depois de conferir que o projeto selecionado e o de cloud correto.

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Antes de confirmar qualquer operacao, conferir no terminal o `PROJECT_REF`. Nao usar projeto de producao existente.

## 7. Variaveis de ambiente

Local `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_OCR_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_ENABLE_HOMOLOGATION=false
```

Vercel `Production`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_OCR_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=https://<seu-dominio-ou-vercel-url>
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_ENABLE_HOMOLOGATION=true
```

Depois da homologacao externa, trocar `NEXT_PUBLIC_ENABLE_HOMOLOGATION=false` e fazer novo deploy.

## 8. Seguranca das chaves

- `SUPABASE_SERVICE_ROLE_KEY` e exclusivamente server-side.
- Nunca usar prefixo `NEXT_PUBLIC_` na service role.
- Nunca importar service role em componente client.
- Nunca retornar service role em Server Action, Route Handler ou log.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` pode ficar no cliente, sempre protegida por RLS.
- `OPENAI_API_KEY` tambem e exclusivamente server-side e nao deve ter prefixo `NEXT_PUBLIC_`.
- A leitura de ficha envia a imagem para a OpenAI somente quando o usuario escolhe uma foto e clica em ler ficha.

## 9. URLs de Auth no Supabase

No Supabase, configurar:

```text
Site URL: https://<seu-dominio-ou-vercel-url>
Redirect URLs:
https://<seu-dominio-ou-vercel-url>/**
http://localhost:3000/**
```

Se usar dominio proprio, adicionar o dominio final tambem.

## 10. Criar primeiro administrador

Depois de aplicar as migracoes e configurar `.env.local` apontando para o Supabase Cloud:

```bash
npm run create-admin
```

O script pede nome, e-mail, senha temporaria e confirmacao textual. Ele cria o usuario no Supabase Auth e grava o profile `admin` ativo.

## 11. Validar banco cloud

Com `.env.local` apontando para o projeto Supabase Cloud:

```bash
npm run validate-cloud-db
```

Esse script nao insere dados. Ele valida alcance das tabelas principais, bancos iniciais esperados e RPC de duplicidade. As validacoes de catalogo abaixo devem ser feitas no SQL Editor.

## 12. Catalog Validation SQL

Executar no Supabase SQL Editor para confirmar enums, RLS, policies, triggers e funcoes:

```sql
select typname
from pg_type
where typnamespace = 'public'::regnamespace
  and typname in (
    'user_role',
    'lead_status',
    'lead_temperature',
    'lead_source',
    'payment_method',
    'timeline_event_type',
    'simulation_result',
    'follow_up_status',
    'follow_up_priority'
  )
order by typname;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'profiles',
    'leads',
    'lead_interests',
    'banks',
    'simulations',
    'follow_ups',
    'lead_notes',
    'lead_timeline_events',
    'lead_status_history',
    'activity_logs',
    'settings'
  )
order by tablename;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;

select p.proname, p.prosecdef, array_to_string(p.proconfig, ', ') as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;
```

Conferir:

- todas as tabelas com `rowsecurity = true`;
- nenhuma policy para `anon`;
- funcoes `SECURITY DEFINER` com `search_path` fixo;
- triggers esperadas sem duplicidade.

## 13. Deploy Vercel

1. Criar repositorio no GitHub.
2. Configurar remote local:

```bash
git remote add origin <GITHUB_REPO_URL>
git push -u origin main
```

3. Importar repositorio na Vercel.
4. Configurar variaveis de ambiente.
5. Rodar primeiro deploy.
6. Abrir a URL gerada e testar login admin.

## 14. Homologacao externa

Com `NEXT_PUBLIC_ENABLE_HOMOLOGATION=true`, admin consegue acessar `/homologacao`. A rota continua protegida por login e role admin.

Fluxos minimos:

- login, logout e recuperacao de senha;
- cadastro de lead ficticio;
- simulacao aprovada e negada;
- retornos vencidos, futuros, adiados e concluidos;
- WhatsApp e acao explicita de contato realizado;
- pipeline com reload;
- bancos com criacao, edicao, ativacao/desativacao e exclusao;
- mobile 320px, 375px, 390px e 430px.

## 15. Dados ficticios

Permitido:

- nomes claramente ficticios;
- CPFs de teste sem cliente real;
- telefones de teste;
- e-mails em dominios de teste.

Proibido:

- clientes reais;
- prints com dados reais;
- importar planilhas da loja antes da aprovacao final.

## 16. Backup antes de dados reais

Antes de cadastrar clientes reais:

1. Exportar schema no Supabase.
2. Confirmar backup automatico do projeto.
3. Registrar commit publicado.
4. Desativar `/homologacao`.
5. Fazer teste de restauracao em ambiente separado, se possivel.

## 17. Checklist de go-live

- `npm run lint` passou.
- `npm run build` passou.
- Migracoes aplicadas no projeto correto.
- `npm run validate-cloud-db` passou.
- SQL de catalogo conferido.
- Primeiro admin criado.
- RLS testado com admin e vendedor ficticio.
- Nenhum dado real usado.
- Nenhuma chave em Git.
- Homologacao desativada antes do uso real.

## 18. Problemas conhecidos

- Este workspace ainda nao tem remote GitHub configurado.
- A publicacao na Vercel depende de credenciais e configuracoes que devem ser feitas pelo usuario.
- O validador Node nao consegue listar policies/triggers via PostgREST; por isso o SQL de catalogo e obrigatorio.

## 19. Recomendacao

Prosseguir para publicacao cloud somente em projeto Supabase novo, com dados ficticios e `/homologacao` ligado temporariamente. Nao iniciar uso com clientes reais antes de completar o checklist de go-live.
