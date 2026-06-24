/**
 * Gate do "Dev Login" — atalho de senha para testar previews onde o magic link
 * não volta para o domínio certo.
 *
 * Habilitado quando:
 *  - é um preview da Vercel (VERCEL_ENV === "preview") — liga sozinho, sem config, ou
 *  - NEXT_PUBLIC_DEV_LOGIN === "1" (forçar manualmente em qualquer ambiente), ou
 *  - fora de produção (dev/localhost).
 *
 * Na PRODUÇÃO real (VERCEL_ENV === "production") fica DESLIGADO por padrão, então
 * o atalho de senha não vira uma superfície de auth indesejada no domínio real.
 */
export function devLoginEnabled(): boolean {
  return (
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_DEV_LOGIN === "1" ||
    process.env.NODE_ENV !== "production"
  );
}
