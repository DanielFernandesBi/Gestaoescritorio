import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: "Middleware" agora se chama Proxy. Renova sessão + gate de acesso.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Roda em tudo, exceto estáticos, imagens e os arquivos públicos do PWA.
     * manifest.json, sw.js e /icons precisam ser servidos SEM o gate de auth —
     * senão o middleware os redireciona pro /login e o Chrome não reconhece o
     * site como instalável (Sug. 81).
     * api/cron TAMBÉM fica fora do gate: o Vercel Cron chama sem cookie de
     * sessão (autentica por Bearer CRON_SECRET na própria rota); sob o gate,
     * o middleware o redirecionava para /login (307) e a rota nunca rodava.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
