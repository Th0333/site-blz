"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryCheckoutAction, switchToInPersonAction } from "../../actions";

export function PaymentActions({ bookingId, allowInPerson }: { bookingId: string; allowInPerson: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Button
        size="lg"
        className="w-full bg-cherry hover:bg-wine"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await retryCheckoutAction(bookingId);
            if (!r.ok) {
              toast.error(r.error);
              router.refresh();
              return;
            }
            window.location.href = r.data.checkoutUrl;
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Pagar com Mercado Pago
      </Button>
      {allowInPerson && (
        <Button
          variant="outline-light"
          className="w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await switchToInPersonAction(bookingId);
              if (!r.ok) toast.error(r.error);
              else toast.success("Combinado! Você paga no dia do atendimento.");
              router.refresh();
            })
          }
        >
          Prefiro pagar no dia
        </Button>
      )}
    </div>
  );
}
