import { PAYMENT_TX_STATUSES } from "@/db/schema";
import { getSessionUser } from "@/server/session";
import { listTransactions } from "@/server/finance";
import { rangeFromParams } from "@/lib/range";
import { PAYMENT_TX_LABEL, TX_METHOD_LABEL } from "@/lib/labels";
import { fmtDateShort, fmtDateTime } from "@/lib/time";

/** Exportação CSV do histórico financeiro (somente administradoras). */
export async function GET(req: Request) {
  const u = await getSessionUser();
  if (!u || u.role !== "admin") return new Response("Acesso negado", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const range = rangeFromParams(sp);
  const review = sp.revisao === "1";
  const rows = await listTransactions(
    {
      from: review ? undefined : range.from,
      to: review ? undefined : range.to,
      status: (PAYMENT_TX_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined,
      provider: sp.canal === "online" ? "mercadopago" : sp.canal === "presencial" ? "manual" : undefined,
      q: sp.q || undefined,
      review,
    },
    10_000,
  );
  const money = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Evita injeção de fórmulas ao abrir no Excel/Sheets
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ["Código", "Cliente", "E-mail", "Serviço", "Profissional", "Data do atendimento", "Canal", "Meio", "Valor bruto", "Taxa", "Líquido", "Status", "Pago em", "ID do pedido", "ID da transação", "Observações", "Revisão"];
  const lines = rows.map((t) =>
    [
      t.bookingCode,
      t.clientName,
      t.clientEmail,
      t.serviceName,
      t.professionalName,
      fmtDateShort(t.startsAt),
      t.payment.provider === "manual" ? "Presencial" : "Mercado Pago",
      t.payment.method ? TX_METHOD_LABEL[t.payment.method] ?? t.payment.method : "",
      money(t.payment.paidAmountCents ?? t.payment.amountCents),
      money(t.payment.feeCents),
      money(t.payment.netCents),
      PAYMENT_TX_LABEL[t.payment.status],
      t.payment.paidAt ? fmtDateTime(t.payment.paidAt) : "",
      t.payment.providerOrderId,
      t.payment.providerPaymentId,
      t.payment.notes,
      t.payment.reviewReason && !t.payment.reviewResolvedAt ? t.payment.reviewReason : "",
    ]
      .map(esc)
      .join(";"),
  );
  const body = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${range.fromYmd}-a-${range.toYmdInclusive}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
