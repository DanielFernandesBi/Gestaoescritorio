import type { ReactNode } from "react";

/**
 * Renderizador de markdown mínimo e SEM dependência externa (server-safe).
 * Cobre o que o briefing usa: títulos (#..####), listas (- / 1.), parágrafos,
 * **negrito**, *itálico*, `código` e [link](url). Não usa dangerouslySetInnerHTML
 * (sem risco de XSS) nem libs ESM que quebram no runtime RSC.
 */
function inline(text: string, kp: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] != null) out.push(<strong key={`${kp}${i}`}>{m[2]}</strong>);
    else if (m[3] != null) out.push(<em key={`${kp}${i}`}>{m[3]}</em>);
    else if (m[4] != null) out.push(<code key={`${kp}${i}`}>{m[4]}</code>);
    else if (m[5] != null) out.push(<a key={`${kp}${i}`} href={m[6]}>{m[5]}</a>);
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ children }: { children: string }) {
  const lines = (children ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(h[1].length, 4);
      const c = inline(h[2], `h${key}-`);
      blocks.push(
        lvl === 1 ? <h1 key={key}>{c}</h1> : lvl === 2 ? <h2 key={key}>{c}</h2> : lvl === 3 ? <h3 key={key}>{c}</h3> : <h4 key={key}>{c}</h4>,
      );
      key++; i++; continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const it = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        items.push(<li key={items.length}>{inline(it, `li${key}-${items.length}-`)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      key++; continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    const parts: ReactNode[] = [];
    para.forEach((p, idx) => {
      if (idx) parts.push(<br key={`br${key}-${idx}`} />);
      parts.push(...inline(p, `p${key}-${idx}-`));
    });
    blocks.push(<p key={key}>{parts}</p>);
    key++;
  }
  return <>{blocks}</>;
}
