export type BadgeKind = "alert" | "warn" | undefined;

export type NavItem = {
  id: string;
  label: string;
  ico: string;
  href: string;
  badgeKey?: string; // chave em `badges` para mostrar contagem
  kind?: BadgeKind;
};

export type NavGroup = { grp: string; items: NavItem[]; ia?: boolean };

/* Estrutura da barra lateral (alvo Plantão): HOJE · ACERVO · TRABALHO ·
 * ENTRADA·IA · GESTÃO. Estudos de caso saiu da navegação principal — vive
 * dentro do drawer do cliente (seção própria). Itens do print sem página
 * correspondente (Execução penal, Documentos & Modelos) ficam de fora. */
export const NAV: NavGroup[] = [
  {
    grp: "Hoje",
    items: [
      { id: "painel", label: "Ritual matinal", ico: "grid", href: "/painel" },
      { id: "validacao", label: "Validação", ico: "check", href: "/validacao", badgeKey: "validacao", kind: "warn" },
      { id: "agenda", label: "Agenda", ico: "calendar", href: "/agenda" },
    ],
  },
  {
    grp: "Acervo",
    items: [
      { id: "processos", label: "Processos", ico: "folder", href: "/processos", badgeKey: "processos" },
      { id: "clientes", label: "Clientes", ico: "users", href: "/clientes", badgeKey: "clientes" },
    ],
  },
  {
    grp: "Trabalho",
    items: [
      { id: "caixa", label: "Caixa de trabalho", ico: "inbox", href: "/caixa" },
      { id: "prazos", label: "Prazos", ico: "clock", href: "/prazos", badgeKey: "prazos", kind: "alert" },
      { id: "audiencias", label: "Audiências", ico: "gavel", href: "/audiencias", badgeKey: "audiencias" },
      { id: "tarefas", label: "Tarefas", ico: "list", href: "/tarefas", badgeKey: "tarefas" },
      { id: "producao", label: "Produção · peças", ico: "file", href: "/producao", badgeKey: "pecas" },
      { id: "notas", label: "Notas", ico: "book", href: "/notas" },
    ],
  },
  {
    grp: "Entrada · IA",
    ia: true,
    items: [
      { id: "intimacoes", label: "Intimações", ico: "inbox", href: "/intimacoes", badgeKey: "intimacoes" },
      { id: "andamentos", label: "Andamentos", ico: "activity", href: "/andamentos", badgeKey: "andamentos", kind: "warn" },
      { id: "alertas", label: "Alertas", ico: "bell", href: "/alertas", badgeKey: "alertas", kind: "alert" },
      { id: "inercia", label: "Inércia · silêncio", ico: "clock", href: "/inercia", badgeKey: "inercia", kind: "warn" },
      { id: "varredura", label: "Varredura", ico: "shield", href: "/varredura" },
      { id: "triagem", label: "Triagem · órfãos", ico: "list", href: "/triagem", badgeKey: "triagem", kind: "warn" },
    ],
  },
  {
    grp: "Gestão",
    items: [
      { id: "negocios", label: "Novos negócios", ico: "briefcase", href: "/negocios" },
      { id: "financeiro", label: "Financeiro", ico: "wallet", href: "/financeiro", badgeKey: "financeiro", kind: "alert" },
      { id: "notificacoes", label: "Notificações", ico: "bell", href: "/notificacoes" },
      { id: "auditoria", label: "Auditoria", ico: "shield", href: "/auditoria" },
      { id: "duplicados", label: "Duplicados", ico: "users", href: "/duplicados", badgeKey: "duplicados", kind: "warn" },
      { id: "sistema", label: "Sistema · evolução", ico: "settings", href: "/sistema" },
    ],
  },
];

export type Badges = Record<string, number>;
