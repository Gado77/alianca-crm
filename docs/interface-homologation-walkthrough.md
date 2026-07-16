# Walkthrough de homologação pela interface

Data: 2026-07-15

## Escopo

Preparação para homologação completa pela interface do Aliança CRM, usando somente ambiente local/de homologação e dados fictícios.

## Rotas preparadas

- `/login`
- `/recuperar-senha`
- `/redefinir-senha`
- `/`
- `/leads`
- `/leads/[id]`
- `/retornos`
- `/pipeline`
- `/estatisticas`
- `/bancos`
- `/usuarios`
- `/configuracoes`
- `/homologacao`

## Checklist

Foi criada a rota protegida `/homologacao`, visível apenas para admin.

Cada item possui:

- descrição;
- link para a tela correspondente;
- status manual: `Não testado`, `Aprovado`, `Reprovado`;
- campo de observação;
- botão para limpar o checklist.

O checklist não aprova nada automaticamente. O estado temporário fica no `localStorage` apenas com status e observações de homologação, sem CPF, telefone, data de nascimento, tokens ou dados reais.

## Seed fictício

A rota `/homologacao` contém um seed opcional, executado somente por admin, que cria:

- dois vendedores fictícios;
- cinco leads fictícios;
- interesses;
- uma simulação aprovada;
- uma simulação negada;
- retornos vencidos e futuros;
- uma venda finalizada.

Nenhum dado real deve ser usado.

## WhatsApp

Foi separado o clique de WhatsApp do contato realizado:

- `WhatsApp` registra somente `whatsapp_opened`;
- o clique não atualiza `last_contact_at`;
- `Marcar contato como realizado` atualiza `last_contact_at`;
- `Marcar contato como realizado` registra `contact_completed`;
- a timeline não recebe CPF, telefone, data de nascimento ou token.

Foi adicionada a migração `20260715183000_contact_completed_timeline.sql` para permitir o evento `contact_completed`.

## Mobile

Viewports verificados por navegador integrado:

- 320px;
- 375px;
- 390px;
- 430px.

Resultado observado:

- barra inferior fixa presente;
- botão `Mais` presente;
- `main` com padding inferior de 86px, maior que a barra inferior de aproximadamente 65px;
- `safe-area` preservada por CSS;
- sem overflow horizontal no `body`;
- Kanban mantém overflow horizontal interno intencional;
- formulários, cards, retornos, leads e homologação não geraram overflow horizontal global.

Observação: o controlador do navegador travou ao tentar clicar programaticamente no botão `Mais`, mas o DOM confirmou o botão visível. A implementação do menu está no `AppShell` e renderiza itens por permissão.

## Permissões

Preparado para testar manualmente:

- admin acessa `/homologacao`, `/usuarios`, `/bancos` e menus administrativos;
- vendedor não recebe link de `/homologacao` no menu;
- `/homologacao` faz checagem server-side e retorna `notFound()` para não admin;
- rota protegida sem sessão redireciona para `/login`.

## Logs e erros

Foi adicionada tela de erro recuperável no grupo CRM:

- mensagem compreensível;
- sem stack trace;
- botão `Tentar novamente`.

Actions administrativas registram erro técnico no servidor com mensagens curtas, sem logar CPF, telefone, data de nascimento ou tokens.

## Build

Comandos executados:

```text
npm run lint
npm run build
```

Resultado:

- lint aprovado;
- build aprovado;
- rota `/homologacao` incluída no build;
- `/homologacao` sem sessão retorna redirect 307 para login.

## Resultado do Kanban

- drag-and-drop desktop já persistia via server action;
- seletor mobile permanece disponível;
- overflow horizontal interno é intencional;
- atualização após reload deve ser marcada manualmente no checklist.

## Problemas encontrados e correções

- `whatsapp_opened` atualizava `last_contact_at`; corrigido.
- faltava evento `contact_completed`; adicionada migração.
- faltava checklist manual de homologação; criada rota `/homologacao`.
- faltava seed fictício pela interface; criado seed admin-only.
- faltava erro recuperável sem stack trace; criada tela `error.tsx`.

## Recomendação

Não recomendo produção ainda. A aplicação está pronta para homologação completa pela interface, mas a liberação deve aguardar o checklist manual ser executado com admin, vendedor 1 e vendedor 2, principalmente em permissões, WhatsApp, simulações negadas e transições inválidas do pipeline.
