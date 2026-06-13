# Fernandes Advocacia — Sistema de Gestão (frontend)

Frontend do sistema de gestão do escritório **Fernandes Advocacia** (criminal).
Next.js (App Router) + `@supabase/ssr` + Supabase Auth + Tailwind, deploy no Vercel.

> **Fase 1 = SOMENTE LEITURA.** As páginas leem com a *sessão do usuário* para que o
> RLS valha. A `service_role` **nunca** vai para o cliente (e nesta fase nem é usada).
> Doutrina do manual: prazos penais em dias corridos · gate `validado=false` ·
> nunca deletar · `segredo_justica` sempre sinalizado.

## Stack

- **Next.js 16** (App Router, Turbopack) — *middleware* agora é `proxy.ts`.
- **@supabase/ssr** — clientes browser/servidor + renovação de sessão no `proxy.ts`.
- **Supabase Auth** — login por **magic link** (sem senha), restrito por allowlist.
- **Tailwind v4** + sistema de design portado do HTML de referência (paleta, tipografia,
  semáforo de prazo, gate de validação).

## Configuração

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://yaqrfftsnqqecoaqssij.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
ALLOWED_EMAILS=danielsfernandes8@gmail.com    # Rodolfo entra aqui depois
NEXT_PUBLIC_SITE_URL=http://localhost:3000     # em produção, a URL do Vercel
```

```bash
npm install
npm run dev      # http://localhost:3000
```

## Login (magic link)

1. O acesso é restrito aos e-mails de `ALLOWED_EMAILS` (Daniel e, depois, Rodolfo).
   O gate é aplicado em três camadas: na ação de envio, no `proxy.ts` e no callback.
2. Funciona **sem mexer no painel do Supabase**: `/auth/confirm` trata tanto o fluxo
   PKCE (`?code=`, template padrão) quanto o `token_hash` (template SSR).
3. *(Opcional, mais robusto p/ clicar o link no celular)* No Supabase Dashboard →
   **Authentication → Emails → Magic Link**, troque `{{ .ConfirmationURL }}` por:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
4. Confirme em **Authentication → URL Configuration** que a Site URL e os Redirect URLs
   incluem o domínio em uso (localhost em dev, a URL do Vercel em produção).

## Estrutura

```
proxy.ts                      # renova sessão + gate de acesso (Next 16)
app/login/                    # tela de login (magic link) + server action
app/auth/confirm/route.ts     # callback do magic link (PKCE e token_hash)
app/auth/signout/route.ts     # logout
app/(app)/layout.tsx          # shell: sidebar + topbar + drawer (busca badges ao vivo)
app/(app)/painel/             # Painel — ritual matinal (LIGADO ao banco)
app/(app)/<modulo>/           # demais módulos (em construção na sequência da Fase 1)
lib/supabase/                 # clients browser/server + proxy (padrão @supabase/ssr)
lib/queries.ts                # leituras das views/tabelas (badges + painel)
lib/allowlist.ts              # allowlist de e-mails
components/                   # Sidebar, Topbar, Drawer, UI (semáforo, pills, gate)...
```

## Relatórios → views (preferidas)

`vw_pendentes_validacao`, `vw_prazos_abertos`, `vw_intimacoes_orfas`, `vw_agenda_semana`,
`vw_financeiro_pendente`, `vw_situacao_cliente`, `vw_relatorio_diario`,
`vw_movimentacoes_recentes`, `vw_andamentos_orfaos`.

## Status

- ✅ Projeto, `.env.local`, login (magic link + allowlist), shell e **Painel** ligados ao banco real.
- ⏳ Próximos: Validação, Prazos, Audiências, Intimações (com órfãs), Tarefas, Processos,
  Clientes, Andamentos, Financeiro, Auditoria, Sistema — todos somente leitura, com
  linhas clicáveis abrindo o painel lateral de detalhe e busca global.
