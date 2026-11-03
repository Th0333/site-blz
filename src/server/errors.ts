/** Erro de regra de negócio com mensagem segura para exibir ao usuário. */
export class BusinessError extends Error {
  constructor(
    message: string,
    public code = "business_error",
  ) {
    super(message);
  }
}

/** Extrai o código SQLSTATE do PostgreSQL de erros embrulhados pelo Drizzle. */
export function pgCode(err: unknown): string | undefined {
  let e = err as { code?: unknown; cause?: unknown } | undefined;
  for (let i = 0; i < 5 && e; i++) {
    if (typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code)) return e.code;
    e = e.cause as typeof e;
  }
  return undefined;
}

export const isOverlapError = (e: unknown) => pgCode(e) === "23P01";
export const isUniqueError = (e: unknown) => pgCode(e) === "23505";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

/** Converte exceções em resultado serializável para server actions. */
export async function toResult<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const e = err as Error & { status?: number };
    if (err instanceof BusinessError || e?.name === "AuthError" || e?.constructor?.name === "AuthError") {
      return { ok: false, error: e.message };
    }
    if (e?.name === "ZodError") return { ok: false, error: "Dados inválidos. Revise os campos e tente novamente." };
    // Erros de controle de fluxo do Next (redirect/notFound) precisam propagar
    if (typeof (e as { digest?: string })?.digest === "string") throw err;
    console.error("[action] erro inesperado:", e?.message);
    return { ok: false, error: "Não foi possível concluir a operação. Tente novamente em instantes." };
  }
}
