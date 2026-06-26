"use client";

/**
 * Gera um PDF do briefing do dia a partir do HTML já renderizado (resumo + corpo).
 * Abre uma janela de impressão limpa (somente o briefing) — o navegador salva como
 * PDF. Sem dependências: usa o próprio motor de impressão → PDF do browser.
 */
export function BriefingPdfBtn({
  data,
  gerado,
  autor,
}: {
  data: string;
  gerado?: string | null;
  autor?: string | null;
}) {
  function gerar() {
    const resumo = document.getElementById("bf-resumo")?.innerHTML ?? "";
    const corpo = document.getElementById("bf-corpo")?.innerHTML ?? "";
    if (!resumo && !corpo) return;

    const titulo = `Briefing — Ritual matinal · ${data}`;
    const sub = [gerado ? `gerado às ${gerado}` : null, autor].filter(Boolean).join(" · ");

    const css = `
      @page { size: A4; margin: 22mm 18mm; }
      * { box-sizing: border-box; }
      body { font-family: -apple-system, "Segoe UI", "Hanken Grotesk", system-ui, sans-serif; color: #1a1d26; font-size: 12.5pt; line-height: 1.6; margin: 0; }
      .bf-head { border-bottom: 2px solid #161922; padding-bottom: 10px; margin-bottom: 18px; }
      .bf-firma { font-family: Georgia, "Instrument Serif", serif; font-size: 17pt; color: #161922; }
      .bf-firma b { color: #3f3ae6; font-style: italic; font-weight: 400; }
      .bf-tit { font-size: 14pt; font-weight: 700; margin-top: 6px; }
      .bf-sub { font-size: 9.5pt; color: #616a78; margin-top: 3px; text-transform: none; }
      main { font-size: 12pt; }
      h1, h2, h3, h4 { font-weight: 700; color: #161922; line-height: 1.3; margin: 16px 0 6px; }
      h1 { font-size: 15pt; } h2 { font-size: 13.5pt; } h3 { font-size: 12.5pt; }
      p { margin: 7px 0; }
      ul, ol { margin: 7px 0; padding-left: 20px; }
      li { margin: 3px 0; }
      strong, b { font-weight: 700; }
      code { font-family: "Geist Mono", ui-monospace, Menlo, monospace; font-size: 90%; background: #f1f2f6; padding: 1px 4px; border-radius: 4px; }
      a { color: #2e29c4; text-decoration: none; }
      hr { border: none; border-top: 1px solid #e1e6ec; margin: 14px 0; }
      .bf-foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e1e6ec; font-size: 8.5pt; color: #909aa8; }
    `;

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title><style>${css}</style></head><body>
      <div class="bf-head">
        <div class="bf-firma">Fernandes <b>&amp;</b> Fernandes</div>
        <div class="bf-tit">Briefing · Ritual matinal — ${data}</div>
        ${sub ? `<div class="bf-sub">${sub}</div>` : ""}
      </div>
      <main>${resumo}${corpo ? `<hr>${corpo}` : ""}</main>
      <div class="bf-foot">Gerado pelo sistema de gestão · Fernandes Advocacia. Documento de trabalho interno.</div>
    </body></html>`;

    const w = window.open("", "_blank", "width=860,height=1040");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // dá tempo de aplicar o CSS antes de abrir o diálogo de impressão → PDF.
    setTimeout(() => { w.print(); }, 350);
  }

  return (
    <button type="button" className="btn sm bf-pdf-btn" onClick={gerar}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 4h11l5 5v11H4z" /><path d="M12 11v6M9 14l3 3 3-3" />
      </svg>
      Gerar PDF
    </button>
  );
}
