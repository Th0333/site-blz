import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* ------------------------------------------------------------------ */
/* Autenticação (tabelas exigidas pelo Better Auth)                    */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** Login alternativo ao e-mail (ex.: "admin"). Definido só pelo script de administração. */
  username: text("username").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  /** client | professional | admin — nunca definido pelo cadastro público */
  role: text("role").notNull().default("client"),
  phone: text("phone"),
  acceptedTermsAt: ts("accepted_terms_at"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Mídia (fotos persistidas no banco, servidas por /api/media/:id)     */
/* ------------------------------------------------------------------ */

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  mime: text("mime").notNull(),
  /** Conteúdo do arquivo (uploads). Nulo quando a mídia é uma URL externa (ex.: fotos de demonstração). */
  data: bytea("data"),
  url: text("url"),
  width: integer("width"),
  height: integer("height"),
  bytes: integer("bytes").notNull().default(0),
  alt: text("alt"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Profissionais, serviços e expedientes                               */
/* ------------------------------------------------------------------ */

export const professionals = pgTable(
  "professionals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Conta opcional para o perfil "profissional" ver a própria agenda */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull().unique(),
    specialties: text("specialties").array().notNull().default(sql`'{}'::text[]`),
    bio: text("bio").notNull().default(""),
    photoId: uuid("photo_id").references(() => media.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("professionals_user_uq").on(t.userId)],
);

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull().default("Maquiagem"),
  description: text("description").notNull().default(""),
  photoId: uuid("photo_id").references(() => media.id, { onDelete: "set null" }),
  priceCents: integer("price_cents").notNull(),
  /** true = exibe "a partir de" na vitrine; o valor cobrado continua sendo price_cents */
  priceFrom: boolean("price_from").notNull().default(false),
  durationMin: integer("duration_min").notNull(),
  bufferMin: integer("buffer_min").notNull().default(0),
  active: boolean("active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const serviceProfessionals = pgTable(
  "service_professionals",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.professionalId] })],
);

/** Jornada semanal: minutos desde 00:00 no fuso do estúdio. */
export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = domingo
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    breakStartMin: integer("break_start_min"),
    breakEndMin: integer("break_end_min"),
  },
  (t) => [uniqueIndex("working_hours_pro_day_uq").on(t.professionalId, t.weekday)],
);

/** Folgas, férias e bloqueios. professional_id nulo = estúdio inteiro fechado. */
export const timeOff = pgTable(
  "time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professionalId: uuid("professional_id").references(() => professionals.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull().default("bloqueio"), // folga | ferias | bloqueio | feriado
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    reason: text("reason"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("time_off_range_idx").on(t.professionalId, t.startsAt, t.endsAt)],
);

/* ------------------------------------------------------------------ */
/* Agendamentos                                                        */
/* ------------------------------------------------------------------ */

export const BOOKING_STATUSES = [
  "pending_payment", // reserva temporária aguardando pagamento online
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "expired", // reserva temporária expirou sem pagamento
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Status que ocupam a agenda (usados também na constraint de exclusão). */
export const BLOCKING_STATUSES: BookingStatus[] = [
  "pending_payment",
  "scheduled",
  "confirmed",
  "completed",
];

export const PAYMENT_STATUSES = [
  "pending", // aguardando pagamento (presencial ou online)
  "paid",
  "refunded",
  "not_charged", // cancelado antes de qualquer cobrança
  "review", // divergência: exige análise administrativa
] as const;
export type BookingPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    professionalId: uuid("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    // Snapshot do serviço no momento da reserva (não muda retroativamente)
    serviceName: text("service_name").notNull(),
    serviceDescription: text("service_description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    durationMin: integer("duration_min").notNull(),
    bufferMin: integer("buffer_min").notNull().default(0),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    /** fim do bloqueio na agenda = endsAt + tempo de preparação */
    blockEndsAt: ts("block_ends_at").notNull(),
    status: text("status").$type<BookingStatus>().notNull().default("scheduled"),
    paymentMethod: text("payment_method").$type<"in_person" | "online">().notNull(),
    paymentStatus: text("payment_status").$type<BookingPaymentStatus>().notNull().default("pending"),
    holdExpiresAt: ts("hold_expires_at"),
    clientNotes: text("client_notes"),
    adminNotes: text("admin_notes"),
    cancelReason: text("cancel_reason"),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => user.id, { onDelete: "set null" }),
    checkedInAt: ts("checked_in_at"),
    completedAt: ts("completed_at"),
    rescheduledFrom: ts("rescheduled_from"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("bookings_client_idx").on(t.clientId, t.startsAt),
    index("bookings_pro_time_idx").on(t.professionalId, t.startsAt),
    index("bookings_status_idx").on(t.status),
    index("bookings_hold_idx").on(t.holdExpiresAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Pagamentos e lançamentos financeiros                                */
/* ------------------------------------------------------------------ */

export const PAYMENT_TX_STATUSES = [
  "created", // tentativa criada, cliente ainda não pagou
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
  "expired",
] as const;
export type PaymentTxStatus = (typeof PAYMENT_TX_STATUSES)[number];

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    provider: text("provider").$type<"mercadopago" | "manual">().notNull(),
    /** pix, credit_card, debit_card, cash, bank_transfer, account_money... */
    method: text("method"),
    status: text("status").$type<PaymentTxStatus>().notNull().default("created"),
    statusDetail: text("status_detail"),
    amountCents: integer("amount_cents").notNull(),
    paidAmountCents: integer("paid_amount_cents"),
    feeCents: integer("fee_cents"),
    netCents: integer("net_cents"),
    environment: text("environment").$type<"test" | "production">(),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    checkoutUrl: text("checkout_url"),
    idempotencyKey: text("idempotency_key").notNull(),
    paidAt: ts("paid_at"),
    receivedBy: text("received_by").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
    reviewReason: text("review_reason"),
    reviewResolvedAt: ts("review_resolved_at"),
    lastSyncedAt: ts("last_synced_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    uniqueIndex("payments_idem_uq").on(t.idempotencyKey),
    uniqueIndex("payments_provider_order_uq").on(t.providerOrderId),
    // Um agendamento nunca pode ter dois pagamentos aprovados "regulares".
    // Uma aprovação duplicada (ex.: cliente pagou duas vezes) é registrada com review_reason.
    uniqueIndex("payments_one_approved_per_booking")
      .on(t.bookingId)
      .where(sql`status = 'approved' and review_reason is null`),
  ],
);

/** Livro-caixa: só contém dinheiro efetivamente recebido ou devolvido. */
export const financialEntries = pgTable(
  "financial_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    kind: text("kind").$type<"receipt" | "refund">().notNull(),
    channel: text("channel").$type<"online" | "in_person">().notNull(),
    method: text("method"),
    /** positivo para recebimento, negativo para estorno */
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents"),
    occurredAt: ts("occurred_at").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    // Idempotência contábil: um recebimento e no máximo um estorno por pagamento
    uniqueIndex("financial_entries_payment_kind_uq").on(t.paymentId, t.kind),
    index("financial_entries_time_idx").on(t.occurredAt),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    /** chave de deduplicação: x-request-id ou id da notificação */
    eventKey: text("event_key").notNull(),
    topic: text("topic"),
    action: text("action"),
    resourceId: text("resource_id"),
    signatureValid: boolean("signature_valid").notNull(),
    status: text("status").$type<"received" | "processed" | "ignored" | "error">().notNull(),
    error: text("error"),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
  },
  (t) => [uniqueIndex("webhook_events_key_uq").on(t.provider, t.eventKey)],
);

/* ------------------------------------------------------------------ */
/* Configurações e conteúdo                                            */
/* ------------------------------------------------------------------ */

/** Linha única (id = 1) com as configurações do estúdio em JSON validado por zod. */
export const studioSettings = pgTable("studio_settings", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").notNull().default({}),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
});

/** Linha única (id = 1) com a integração Mercado Pago. Segredos sempre criptografados. */
export const paymentIntegration = pgTable("payment_integration", {
  id: integer("id").primaryKey().default(1),
  environment: text("environment").$type<"test" | "production">().notNull().default("test"),
  publicKey: text("public_key"),
  accessTokenEnc: text("access_token_enc"),
  accessTokenLast4: text("access_token_last4"),
  webhookSecretEnc: text("webhook_secret_enc"),
  lastCheckAt: ts("last_check_at"),
  lastCheckStatus: text("last_check_status"),
  lastCheckMessage: text("last_check_message"),
  accountNickname: text("account_nickname"),
  accountSiteId: text("account_site_id"),
  lastWebhookAt: ts("last_webhook_at"),
  lastApprovedTestAt: ts("last_approved_test_at"),
  lastApprovedLiveAt: ts("last_approved_live_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
});

export const integrationErrors = pgTable("integration_errors", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(),
  context: text("context").notNull(),
  message: text("message").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const testimonials = pgTable("testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorName: text("author_name").notNull(),
  authorUserId: text("author_user_id").references(() => user.id, { onDelete: "set null" }),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  text: text("text").notNull(),
  rating: smallint("rating"),
  serviceLabel: text("service_label"),
  approved: boolean("approved").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const galleryItems = pgTable("gallery_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  mediaId: uuid("media_id")
    .notNull()
    .references(() => media.id, { onDelete: "cascade" }),
  caption: text("caption"),
  professionalId: uuid("professional_id").references(() => professionals.id, {
    onDelete: "set null",
  }),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const faqs = pgTable("faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Eventos (notificações) e auditoria                                  */
/* ------------------------------------------------------------------ */

export const EVENT_TYPES = [
  "client.registered",
  "booking.created",
  "booking.cancelled",
  "booking.rescheduled",
  "payment.approved",
  "payment.rejected",
  "payment.refunded",
  "payment.review",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<EventType>().notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** sent | skipped (sem serviço de e-mail) | failed */
    emailStatus: text("email_status"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("events_user_idx").on(t.userId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);
