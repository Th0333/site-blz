import { getMedia } from "@/server/media";

export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const m = await getMedia(id);
  if (!m) return new Response("Não encontrado", { status: 404 });
  if (m.url) return Response.redirect(m.url, 302);
  if (!m.data) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(m.data.length),
      // ids são imutáveis: trocar a foto gera um novo id
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
