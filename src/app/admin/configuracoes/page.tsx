import Link from "next/link";
import { CreditCard } from "lucide-react";
import { getSettings } from "@/server/settings";
import { hasDemoData } from "@/server/demo";
import { getMpConfig } from "@/server/mercadopago";
import { emailConfigured } from "@/server/email";
import { PageHeader } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media-url";
import { SettingsForms } from "./forms";

export const metadata = { title: "Configurações do estúdio" };

export default async function SettingsPage() {
  const [s, demo, mp] = await Promise.all([getSettings(), hasDemoData(), getMpConfig()]);
  return (
    <>
      <PageHeader
        title="Configurações do estúdio"
        description="Identidade, textos do site, contato, regras de agendamento e formas de pagamento."
        actions={<Link href="/admin/configuracoes/mercado-pago" className={buttonVariants({ variant: "outline" })}><CreditCard className="size-4" /> Integração Mercado Pago</Link>}
      />
      <SettingsForms
        s={s}
        images={{ logoId: mediaUrl(s.logoId), heroImageId: mediaUrl(s.heroImageId), heroSecondaryImageId: mediaUrl(s.heroSecondaryImageId), aboutImageId: mediaUrl(s.aboutImageId) }}
        demo={demo}
        mpConfigured={!!mp.accessToken}
        emailOn={emailConfigured()}
      />
    </>
  );
}
