import { getProcessosInercia } from "@/lib/queries";
import { InerciaView } from "@/components/modules/InerciaView";

export const dynamic = "force-dynamic";

export default async function InerciaPage() {
  const processos = await getProcessosInercia();
  return <InerciaView processos={processos} />;
}
