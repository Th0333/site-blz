import type { BookingPaymentStatus, BookingStatus, PaymentTxStatus } from "@/db/schema";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: "Reservado (aguardando pagamento)",
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
  expired: "Reserva expirada",
};

export const PAYMENT_STATUS_LABEL: Record<BookingPaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  refunded: "Reembolsado",
  not_charged: "Não cobrado",
  review: "Em análise",
};

export const PAYMENT_TX_LABEL: Record<PaymentTxStatus, string> = {
  created: "Checkout iniciado",
  pending: "Em processamento",
  approved: "Aprovado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Contestado",
  expired: "Expirado",
};

export const PAYMENT_METHOD_LABEL: Record<"in_person" | "online", string> = {
  in_person: "No dia do atendimento",
  online: "Online (Mercado Pago)",
};

export const TX_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência",
  account_money: "Saldo Mercado Pago",
  ticket: "Boleto",
  other: "Outro",
};

export const STATUS_TONE: Record<string, string> = {
  pending_payment: "bg-amber-50 text-amber-800 ring-amber-200",
  scheduled: "bg-teal-mist text-teal-deep ring-teal-haze",
  confirmed: "bg-teal text-white ring-teal",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  no_show: "bg-blush-veil text-merlot ring-[#e6c3c8]",
  expired: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  refunded: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  not_charged: "bg-zinc-100 text-zinc-500 ring-zinc-200",
  review: "bg-red-50 text-red-800 ring-red-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  created: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  charged_back: "bg-red-50 text-red-800 ring-red-200",
};
