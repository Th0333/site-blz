-- Proteção definitiva contra dupla reserva: o PostgreSQL rejeita qualquer
-- agendamento ativo cuja ocupação [starts_at, block_ends_at) se sobreponha a
-- outro agendamento ativo da mesma profissional, mesmo sob concorrência.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tstzrange("starts_at", "block_ends_at", '[)') WITH &&
  )
  WHERE ("status" IN ('pending_payment', 'scheduled', 'confirmed', 'completed'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_order" CHECK ("ends_at" > "starts_at" AND "block_ends_at" >= "ends_at");
--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_order" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_values" CHECK ("price_cents" >= 0 AND "duration_min" > 0 AND "buffer_min" >= 0);
--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_values" CHECK ("weekday" BETWEEN 0 AND 6 AND "end_min" > "start_min");
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_cents" > 0);
