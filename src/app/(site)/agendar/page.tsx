import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { getSessionUser } from "@/server/session";
import { getPublicProfessionals, getPublicServices } from "@/server/public-data";
import { getMpConfig } from "@/server/mercadopago";
import { BookingWizard } from "./wizard";

export const metadata: Metadata = { title: "Agendar horário", description: "Escolha serviço, profissional, data e horário com disponibilidade em tempo real." };

export default async function AgendarPage({ searchParams }: PageProps<"/agendar">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const [s, services, pros, user, mp] = await Promise.all([getSettings(), getPublicServices(), getPublicProfessionals(), getSessionUser(), getMpConfig()]);
  const onlineAvailable = s.onlinePaymentEnabled && !!mp.accessToken;
  const startMin = str("hora") ? Number(str("hora")) : undefined;

  return (
    <div className="bg-paper pb-24 pt-28 sm:pt-32">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-10">
        <BookingWizard
          services={services}
          pros={pros}
          user={user ? { name: user.name } : null}
          options={{
            allowAny: s.allowAnyProfessional,
            onlineAvailable,
            inPersonAvailable: s.inPersonPaymentEnabled,
            holdMinutes: s.holdMinutes,
            maxDaysAhead: s.maxDaysAhead,
            cancellationPolicy: s.cancellationPolicy,
            cancelMinHours: s.cancelMinHours,
          }}
          initial={{
            serviceId: str("servico"),
            professionalId: str("profissional"),
            ymd: str("data"),
            startMin: Number.isInteger(startMin) ? startMin : undefined,
          }}
        />
      </div>
    </div>
  );
}
