import { NextResponse, type NextRequest } from "next/server";

/**
 * Barreira otimista: sem cookie de sessão, nem chega a renderizar as áreas protegidas.
 * A verificação definitiva (sessão válida + papel) acontece no servidor em cada página e ação.
 */
export function proxy(req: NextRequest) {
  const hasSession =
    req.cookies.has("better-auth.session_token") || req.cookies.has("__Secure-better-auth.session_token");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/minha-conta/:path*", "/profissional/:path*"],
};
