export type BadgeKind = "alert" | "warn" | undefined;

export type NavItem = {
  id: string;
  label: string;
  ico: string;
  href: string;
  badgeKey?: string; // chave em `badges` para mostrar contagem
  kind?: BadgeKind;
};

export type NavGroup = { grp: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    grp: "Operação",
    items: [
      { id: "painel", label: "Painel — Ritual matinal", ico: "grid", href: "/painel" },
      { id: "validacao", label: "Validação de Daniel", ico: "check", href: "/validacao", badgeKey: "validacao", kind: "warn" },
      { id: "prazos", label: "Prazos penais", ico: "clock", href: "/prazos", badgeKey: "prazos" },
      { id: "audiencias", label: "Audiências", ico: "gavel", href: "/audiencias", badgeKey: "audiencias" },
      { id: "intimacoes", label: "Intimações", ico: "inbox", href: "/intimacoes", badgeKey: "intimacoes", kind: "alert" },
      { id: "tarefas", label: "Tarefas", ico: "list", href: "/tarefas", badgeKey: "tarefas" },
    ],
  },
  {
    grp: "Acervo",
    items: [
      { id: "processos", label: "Processos", ico: "folder", href: "/processos", badgeKey: "processos" },
      { id: "clientes", label: "Clientes", ico: "users", href: "/clientes", badgeKey: "clientes" },
      { id: "andamentos", label: "Andamentos", ico: "activity", href: "/andamentos" },
      { id: "estudos", label: "Estudos de caso", ico: "book", href: "/estudos" },
    ],
  },
  {
    grp: "Gestão",
    items: [
      { id: "financeiro", label: "Financeiro", ico: "wallet", href: "/financeiro" },
      { id: "auditoria", label: "Auditoria", ico: "shield", href: "/auditoria" },
      { id: "sistema", label: "Sistema & evolução", ico: "settings", href: "/sistema" },
    ],
  },
];

export type Badges = Record<string, number>;
