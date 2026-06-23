import { NextResponse } from "next/server";
import { getBadges } from "@/lib/queries";

// Sugestão 53 (c) — badge "ao vivo": a sidebar faz polling leve desta rota para
// refletir mudanças externas (Cowork/chat direto no banco) sem recarregar a página.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBadges(), {
    headers: { "Cache-Control": "no-store" },
  });
}
