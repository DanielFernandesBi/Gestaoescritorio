import "server-only";
import { Readable } from "node:stream";
import { google } from "googleapis";

/**
 * Upload de arquivos ao Google Drive do escritório (pastas do manual:
 * `Sistema/Clientes/<nome do cliente>/...`). Diferente do Calendar (service
 * account), o Drive do escritório é uma conta Gmail comum: uma service account
 * NÃO tem cota e não consegue ser dona de arquivos no "Meu Drive" de terceiros.
 * Por isso o upload usa credenciais OAuth do próprio Daniel (refresh token).
 *
 * Degradação segura: sem credenciais, todas as funções retornam null e o
 * chamador cai no registro manual por id do Drive (nunca derruba a gravação).
 *
 * Env (no Vercel/.env.local):
 *   GOOGLE_OAUTH_CLIENT_ID        — client id do OAuth (Google Cloud Console)
 *   GOOGLE_OAUTH_CLIENT_SECRET    — client secret
 *   GOOGLE_OAUTH_REFRESH_TOKEN    — refresh token de Daniel com escopo drive
 *   GOOGLE_DRIVE_CLIENTES_FOLDER_ID — id da pasta Sistema/Clientes (default abaixo)
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Pasta Sistema/Clientes (descoberta no Drive do escritório); sobreponível por env. */
function clientesFolderId(): string {
  return process.env.GOOGLE_DRIVE_CLIENTES_FOLDER_ID || "1lZ1kkEgK6SeP9DDlY8kHVbghZlyMhzOc";
}

export function driveConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

function cliente() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
}

/** Escapa aspas simples para a query da Drive API. */
function escq(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Acha (ou cria) uma subpasta pelo nome dentro de `parentId`. Retorna o id da
 * pasta, ou null em falha. Idempotente: reaproveita a pasta existente.
 */
async function acharOuCriarPasta(parentId: string, nome: string): Promise<string | null> {
  const drive = cliente();
  if (!drive) return null;
  try {
    const q = `'${escq(parentId)}' in parents and name = '${escq(nome)}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const achou = await drive.files.list({ q, fields: "files(id)", pageSize: 1, spaces: "drive" });
    const existente = achou.data.files?.[0]?.id;
    if (existente) return existente;
    const criada = await drive.files.create({
      requestBody: { name: nome, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: "id",
    });
    return criada.data.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a cadeia de subpastas a partir de Sistema/Clientes, criando o que
 * faltar. Ex.: ["FULANO DE TAL", "Financeiro"] → id da pasta Financeiro do cliente.
 */
async function resolverPasta(caminho: string[]): Promise<string | null> {
  let atual = clientesFolderId();
  for (const parte of caminho) {
    const nome = parte.trim();
    if (!nome) continue;
    const prox = await acharOuCriarPasta(atual, nome);
    if (!prox) return null;
    atual = prox;
  }
  return atual;
}

export type UploadResultado = {
  drive_file_id: string;
  drive_url: string;
  nome: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
};

/**
 * Sobe um arquivo para `Sistema/Clientes/<caminho...>`. Cria as subpastas
 * necessárias. Best-effort: qualquer falha (ou Drive não configurado) → null,
 * e o chamador segue com o registro manual. Marca SEGREDO DE JUSTIÇA é
 * responsabilidade do chamador (no banco), não do nome do arquivo.
 */
export async function uploadParaDrive(args: {
  caminho: string[];
  nome: string;
  mimeType: string | null;
  bytes: Buffer;
}): Promise<UploadResultado | null> {
  const drive = cliente();
  if (!drive) return null;
  try {
    const pastaId = await resolverPasta(args.caminho);
    if (!pastaId) return null;
    const r = await drive.files.create({
      requestBody: { name: args.nome, parents: [pastaId] },
      media: {
        mimeType: args.mimeType ?? "application/octet-stream",
        body: Readable.from(args.bytes),
      },
      fields: "id, name, mimeType, size, webViewLink",
    });
    const id = r.data.id;
    if (!id) return null;
    return {
      drive_file_id: id,
      drive_url: r.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view`,
      nome: r.data.name ?? args.nome,
      mime_type: r.data.mimeType ?? args.mimeType ?? null,
      tamanho_bytes: r.data.size ? Number(r.data.size) : args.bytes.byteLength,
    };
  } catch {
    return null;
  }
}
