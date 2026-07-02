import { NextResponse } from "next/server";
import { getAlertas } from "@/lib/queries";

// Sug. 79 — o sino do topbar faz polling leve desta rota para refletir
// prazos/audiências no limite sem recarregar a página.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAlertas(), {
    headers: { "Cache-Control": "no-store" },
  });
}
