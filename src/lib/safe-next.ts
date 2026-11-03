/** Aceita apenas destinos internos ("/..."), evitando redirecionamentos abertos. */
export function safeNext(next: string | null | undefined, fallback = "/minha-conta") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Traduz códigos de erro do Better Auth para mensagens claras. */
export function authErrorMessage(err: { code?: string; status?: number; message?: string } | null | undefined) {
  if (!err) return "Não foi possível concluir. Tente novamente.";
  if (err.status === 429) return "Muitas tentativas em sequência. Aguarde um minuto e tente de novo.";
  switch (err.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_USERNAME_OR_PASSWORD":
      return "Usuário/e-mail ou senha incorretos.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Já existe uma conta com este e-mail. Entre ou recupere sua senha.";
    case "PASSWORD_TOO_SHORT":
      return "A senha precisa ter pelo menos 8 caracteres.";
    case "PASSWORD_TOO_LONG":
      return "A senha é longa demais.";
    case "EMAIL_NOT_VERIFIED":
      return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    case "INVALID_TOKEN":
      return "Este link expirou ou já foi usado. Solicite um novo.";
    case "INVALID_EMAIL":
      return "Informe um e-mail válido.";
    default:
      return "Não foi possível concluir. Verifique os dados e tente novamente.";
  }
}
