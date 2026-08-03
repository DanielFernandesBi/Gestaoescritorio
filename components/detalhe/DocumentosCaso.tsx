"use client";

import { Pill, SegredoTag } from "@/components/ui";
import { FormModal } from "@/components/FormModal";
import { Acao } from "@/components/Acao";
import { criarDocumento, inativarDocumento, reanalisarPecas } from "@/app/actions";
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
  titulo = "Documentos",
  tipoPadrao = "peca",
}: {
  documentos: Documento[];
  vinculo: { campo: "processo_id" | "cliente_id" | "contrato_id" | "pagamento_id"; id: string };
  segredo?: boolean;
  titulo?: string;
  tipoPadrao?: string;
}) {
  return (
    <div className="dsec">
      <h4>{titulo} ({documentos.length}) {segredo && <SegredoTag on />}</h4>
      <div className="acoes" style={{ marginBottom: 10 }}>
        <FormModal
          label="Adicionar documento"
          titulo="Enviar documento ao Drive"
          descricao="Anexe um arquivo: ele é enviado para a pasta do cliente no Drive (Sistema/Clientes) e registrado no acervo. Sem credenciais de upload, dá para colar o id de um arquivo já no Drive."
          acao={criarDocumento}
          enviarLabel="Enviar / registrar"
          variant="default"
        >
          <input type="hidden" name={vinculo.campo} defaultValue={vinculo.id} />
          <div><label>Arquivo</label><input type="file" name="arquivo" /></div>
          <div><label>Nome (opcional)</label><input name="nome" placeholder="Em branco usa o nome do arquivo enviado." /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label>Tipo</label><select name="tipo" defaultValue={tipoPadrao}>{DOCUMENTO_TIPO.map((t) => <option key={t} value={t}>{humano(t)}</option>)}</select></div>
            <div><label>Origem</label><input name="origem" defaultValue="upload" placeholder="upload / drive / email" /></div>
          </div>
          <div><label>Drive file id (alternativa ao upload)</label><input name="drive_file_id" placeholder="cole o id se o arquivo já estiver no Drive" /></div>
          <div><label>Observações</label><textarea name="observacoes" placeholder="Opcional." /></div>
        </FormModal>
        {vinculo.campo === "processo_id" && (
          <Acao
            label={<>↻ Reavaliar peças pendentes</>}
            variant="default"
            titulo="Reavaliar peças pendentes deste processo"
            confirmarLabel="Marcar para reanálise"
            resumo={<>Chegou documento novo? Marque as peças pendentes deste processo para o <b>redator agendado</b> reavaliar os insumos no próximo ciclo — quem destravar vira minuta (alta); o resto fica em aguardando insumo com a pendência. O sistema nunca redige às cegas nem protocola.</>}
            acao={() => reanalisarPecas(vinculo.id)}
          />
        )}
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
                  {/* O que o arquivo é, em uma linha: data de protocolo, "insumo para T2",
                      "RASCUNHO — não protocolada", aviso de sigilo. Ficava só no banco. */}
                  {d.observacoes && <div className="ms" style={{ marginTop: 5, whiteSpace: "pre-wrap" }}>{d.observacoes}</div>}
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
