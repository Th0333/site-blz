/** URL pública da aplicação (sem barra final). */
export function appUrl() {
  const url =
    process.env.APP_URL ||
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export const isHttps = () => appUrl().startsWith("https://");
