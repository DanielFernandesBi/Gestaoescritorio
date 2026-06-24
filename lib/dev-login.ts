/**
 * Gate do "Dev Login" — atalho de senha para testar previews onde o magic link
 * não volta para o domínio certo.
 *
 * Habilitado quando:
 *  - NEXT_PUBLIC_DEV_LOGIN === "1" (ligar no ambiente Preview da Vercel), ou
 *  - fora de produção (dev/localhost).
 *
 * Em produção fica DESLIGADO por padrão, então o atalho de senha não vira uma
 * superfície de auth indesejada no domínio real.
 */
export function devLoginEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_LOGIN === "1" ||
    process.env.NODE_ENV !== "production"
  );
}
