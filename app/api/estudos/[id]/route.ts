import { NextResponse, type NextRequest } from "next/server";
import { getEstudoDetalhe } from "@/lib/data";

/** Detalhe de um estudo de caso: vínculos com processos e objetivos. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const detalhe = await getEstudoDetalhe(id);
  return NextResponse.json(detalhe ?? {});
}
