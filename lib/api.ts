"use client";

/**
 * Consumo das rotas de dados (`/api/*`) pelo navegador.
 *
 * O PROBLEMA que isto resolve. Toda tela que preenche seletor ou lista por
 * `fetch` fazia `.then(r => r.json()).catch(() => {})`. Quando a sessão expira
 * com a tela aberta, o gate do proxy respondia o fetch com um REDIRECT para
 * /login — que o navegador segue e entrega HTML com status 200. O `r.ok` é
 * verdadeiro, o `r.json()` estoura, o `catch` engole, e a tela fica com lista
 * vazia: nenhum erro, nenhum aviso, e a aparência de "não há processos" quando
 * o que não há é sessão.
 *
 * O CONTRATO agora. O proxy responde 401 (sessão expirada) ou 403 (fora da
 * allowlist) em JSON para `/api/*`, e quem lê vem por aqui: 401/403 manda o
 * navegador para /login, em vez de devolver vazio. Falha de rede e demais
 * erros continuam devolvendo `null` — ficar offline por um instante não deve
 * jogar ninguém para fora.
 *
 * Quem decide o destino é o proxy, não este arquivo: a navegação é para /login
 * e o gate confirma. Por isso `window.location`, e não `router.push` — a
 * recarga também limpa o estado da tela que já está expirada.
 */

/** Uma só navegação, ainda que vários componentes recebam 401 ao mesmo tempo. */
let redirecionando = false;

function irParaLogin() {
  if (redirecionando) return;
  redirecionando = true;
  window.location.assign("/login");
}

/**
 * GET/POST numa rota de dados. Devolve o JSON, ou `null` quando não há resposta
 * utilizável. Sessão caída não devolve `null`: leva para o login.
 */
export async function buscarJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    return null; // offline ou rede instável — mantém a tolerância de antes
  }
  if (r.status === 401 || r.status === 403) {
    irParaLogin();
    return null;
  }
  if (!r.ok) return null;
  try {
    return (await r.json()) as T;
  } catch {
    return null; // resposta sem JSON válido
  }
}

/**
 * Variante para quem precisa do status (ex.: o opt-in de push, que distingue
 * "falhou" de "não autorizado" na mensagem). Sessão caída também redireciona.
 */
export async function buscarResposta(url: string, init?: RequestInit): Promise<Response | null> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    return null;
  }
  if (r.status === 401 || r.status === 403) {
    irParaLogin();
    return null;
  }
  return r;
}
