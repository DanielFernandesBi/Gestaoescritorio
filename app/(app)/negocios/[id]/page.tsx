import { notFound } from "next/navigation";
import { getOportunidade, getFunilNegocios } from "@/lib/data";
import { OportunidadePainel } from "@/components/detalhe/OportunidadePainel";

export const dynamic = "force-dynamic";

export default async function OportunidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [o, lista] = await Promise.all([getOportunidade(id), getFunilNegocios()]);
  if (!o) notFound();
  return <OportunidadePainel o={o} lista={lista} />;
}
