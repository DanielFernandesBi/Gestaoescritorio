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
      { id: "prazos", label: "Prazos", ico: "clock", href: "/prazos", badgeKey: "prazos", kind: "alert" },
      { id: "audiencias", label: "Audiências", ico: "gavel", href: "/audiencias", badgeKey: "audiencias" },
      { id: "tarefas", label: "Tarefas", ico: "list", href: "/tarefas", badgeKey: "tarefas" },
      { id: "producao", label: "Produção · peças", ico: "file", href: "/producao", badgeKey: "pecas" },
    ],
  },
  {
    grp: "Entrada · IA",
    ia: true,
    items: [
      { id: "varredura", label: "Varredura", ico: "shield", href: "/varredura" },
      { id: "intimacoes", label: "Intimações", ico: "inbox", href: "/intimacoes", badgeKey: "intimacoes" },
      { id: "andamentos", label: "Andamentos", ico: "activity", href: "/andamentos" },
      { id: "triagem", label: "Triagem · órfãos", ico: "list", href: "/triagem" },
      { id: "alertas", label: "Alertas", ico: "bell", href: "/alertas", badgeKey: "alertas", kind: "alert" },
    ],
  },
  {
    grp: "Gestão",
    items: [
      { id: "financeiro", label: "Financeiro", ico: "wallet", href: "/financeiro" },
      { id: "auditoria", label: "Auditoria", ico: "shield", href: "/auditoria" },
      { id: "duplicados", label: "Duplicados", ico: "users", href: "/duplicados", badgeKey: "duplicados", kind: "warn" },
      { id: "sistema", label: "Sistema · evolução", ico: "settings", href: "/sistema" },
    ],
  },
];

export type Badges = Record<string, number>;
