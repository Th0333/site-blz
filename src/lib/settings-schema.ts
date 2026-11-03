import { z } from "zod";

const optionalText = z.string().trim().max(5000).default("");

export const openingHoursSchema = z
  .array(
    z.object({
      label: z.string().trim().max(60), // ex.: "Terça a sexta"
      hours: z.string().trim().max(60), // ex.: "09h às 19h"
    }),
  )
  .max(10)
  .default([]);

export const settingsSchema = z.object({
  // Identidade
  studioName: z.string().trim().min(1).max(80).default("Atelier Carmim"),
  tagline: z.string().trim().max(120).default("Beauty studio · maquiagem & beleza"),
  logoId: z.string().uuid().nullable().default(null),

  // Página inicial
  heroEyebrow: z.string().trim().max(80).default("Estúdio de beleza autoral"),
  heroTitle: z.string().trim().max(140).default("Realce sua beleza. Viva sua melhor versão."),
  heroSubtitle: z
    .string()
    .trim()
    .max(300)
    .default("Um momento especial de cuidado, beleza e autoestima, pensado exclusivamente para você."),
  heroImageId: z.string().uuid().nullable().default(null),
  heroSecondaryImageId: z.string().uuid().nullable().default(null),
  aboutTitle: z.string().trim().max(140).default("Beleza com intenção, do primeiro traço ao último retoque."),
  aboutText: optionalText,
  aboutImageId: z.string().uuid().nullable().default(null),
  highlights: z
    .array(z.object({ title: z.string().trim().max(60), text: z.string().trim().max(240) }))
    .max(6)
    .default([]),

  // Contato e localização
  address: optionalText,
  mapsUrl: z.string().trim().max(500).default(""),
  whatsapp: z.string().trim().max(30).default(""), // somente dígitos com DDI, ex.: 5511999999999
  instagram: z.string().trim().max(60).default(""), // usuário sem @
  email: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(30).default(""),
  openingHours: openingHoursSchema,

  // Regras de agendamento
  slotIntervalMin: z.coerce.number().int().min(5).max(120).default(30),
  minNoticeHours: z.coerce.number().int().min(0).max(24 * 14).default(2),
  maxDaysAhead: z.coerce.number().int().min(1).max(365).default(60),
  holdMinutes: z.coerce.number().int().min(5).max(24 * 60).default(30),
  allowAnyProfessional: z.coerce.boolean().default(true),
  cancelMinHours: z.coerce.number().int().min(0).max(24 * 14).default(24),
  rescheduleMinHours: z.coerce.number().int().min(0).max(24 * 14).default(24),
  allowClientCancel: z.coerce.boolean().default(true),
  allowClientReschedule: z.coerce.boolean().default(true),
  cancellationPolicy: optionalText,

  // Pagamentos
  onlinePaymentEnabled: z.coerce.boolean().default(false),
  inPersonPaymentEnabled: z.coerce.boolean().default(true),

  // Textos legais
  privacyPolicy: optionalText,
  termsOfUse: optionalText,
});

export type StudioSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: StudioSettings = settingsSchema.parse({});
