"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { registerWhatsappAction } from "@/app/actions";
import { cn } from "@/lib/utils";

type WhatsappButtonProps = {
  leadId: string;
  href: string;
  className?: string;
  label?: string;
};

export function WhatsappButton({ leadId, href, className, label = "WhatsApp" }: WhatsappButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lead_id", leadId);
      await registerWhatsappAction(formData);
      window.open(href, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#25D366] text-xs font-black text-white disabled:cursor-wait disabled:opacity-70",
        className
      )}
    >
      <MessageCircle className="h-4 w-4" />
      {pending ? "Registrando" : label}
    </button>
  );
}
