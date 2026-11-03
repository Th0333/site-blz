import { z } from "zod";
import { getSettings } from "@/server/settings";
import { getAvailableDates, getDaySlots, expireStaleHolds } from "@/server/availability";
import { isValidYmd } from "@/lib/time";

const q = z.object({
  servico: z.string().uuid(),
  profissional: z.union([z.literal("any"), z.string().uuid()]),
  data: z.string().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
});

/**
 * GET /api/disponibilidade?servico&profissional&de&ate  -> dias com horários livres
 * GET /api/disponibilidade?servico&profissional&data    -> horários livres do dia
 * Consulta pública e somente leitura; a reserva é sempre revalidada no servidor.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  const { servico, profissional, data, de, ate } = parsed.data;
  const settings = await getSettings();
  await expireStaleHolds();

  if (data) {
    if (!isValidYmd(data)) return Response.json({ error: "Data inválida." }, { status: 400 });
    const slots = await getDaySlots({ serviceId: servico, professionalId: profissional, ymd: data, settings });
    return Response.json({ slots: slots.map((s) => ({ startMin: s.startMin, label: s.label })) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!de || !ate || !isValidYmd(de) || !isValidYmd(ate) || ate < de) return Response.json({ error: "Período inválido." }, { status: 400 });
  const dates = await getAvailableDates({ serviceId: servico, professionalId: profissional, fromYmd: de, toYmd: ate, settings });
  return Response.json({ dates }, { headers: { "Cache-Control": "no-store" } });
}
