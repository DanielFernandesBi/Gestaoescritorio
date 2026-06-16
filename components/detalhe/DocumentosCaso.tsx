"use client";

import { Pill, SegredoTag } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { criarDocumento, inativarDocumento } from "@/app/actions";
import { DOCUMENTO_TIPO } from "@/lib/enums";
import { fmtDate, humano } from "@/lib/format";
import type { Documento } from "@/lib/data";

/**
 * Acervo do Drive ligado ao caso (tabela `documentos`). Lê de vw_documentos_processo
 * (já traz segredo_justica e drive_url resolvido). O conteúdo segue no Drive; aqui
 * só registramos/auditamos o ponteiro. Nunca DELETE — "remover" é ativo=false.
 */
export function DocumentosCaso({
  documentos,
  vinculo,
  segredo,
}: {
  documentos: Documento[];
  vinculo: { campo: "processo_id" | "cliente_id"; id: string };
  segredo?: boolean;
}) {
  return (
    <div className="dsec">
      <h4>Documentos ({documentos.length}) {segredo && <SegredoTag on />}</h4>
      <div className="acoes" style={{ marginBottom: 10 }}>
        <FormModal
          label="Adicionar documento"
          titulo="Registrar documento do Drive"
          descricao="Registra o ponteiro do arquivo no Drive (o conteúdo continua no Drive; o banco guarda só os metadados)."
          acao={criarDocumento}
          enviarLabel="Registrar"
          variant="default"
        >
          <input type="hidden" name={vinculo.campo} defaultValue={vinculo.id} />
          <div><label>Nome</label><input name="nome" required placeholder="Ex.: Apelação — razões.pdf" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label>Tipo</label><select name="tipo" defaultValue="peca">{DOCUMENTO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
            <div><label>Origem</label><input name="origem" defaultValue="drive" placeholder="drive / upload / email" /></div>
          </div>
          <div><label>Drive file id</label><input name="drive_file_id" required placeholder="id do arquivo no Drive" /></div>
          <div><label>Observações</label><textarea name="observacoes" placeholder="Opcional." /></div>
        </FormModal>
      </div>
      <div className="mini-list">
        {documentos.length ? (
          documentos.map((d) => {
            const href = d.drive_url ?? (d.drive_file_id ? `https://drive.google.com/file/d/${d.drive_file_id}/view` : null);
            return (
              <div className="mini" key={d.id} style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="mt">{d.nome ?? "—"} {d.segredo && <SegredoTag on />}</div>
                  <div className="ms" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Pill tone="brass" dot={false}>{humano(d.tipo)}</Pill>
                    {d.origem && <span>{d.origem.toUpperCase()}</span>}
                    <span>· {fmtDate(d.criado_em)}</span>
                    {href && <a className="link" href={href} target="_blank" rel="noreferrer">abrir no Drive</a>}
                  </div>
                </div>
                <Acao
                  label="Remover"
                  variant="danger"
                  titulo="Remover documento do acervo"
                  confirmarLabel="Remover"
                  resumo={<>O documento <b>não é apagado</b> — é inativado (sai do acervo, mantido no banco e auditado). O arquivo no Drive <b>não é tocado</b>. Confirmar?</>}
                  acao={() => inativarDocumento(d.id)}
                />
              </div>
            );
          })
        ) : (
          <div className="empty">Nenhum documento registrado.</div>
        )}
      </div>
    </div>
  );
}
