import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CrmAssistant } from "@/components/crm-assistant";
import { getAppContext, getLeadCollections } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getAppContext();
  if (!profile?.active) redirect("/login");
  const { followUps } = await getLeadCollections();
  const pendingCount = followUps.filter((item) => item.status === "pendente").length;
  const assistantEnabled = process.env.NEXT_PUBLIC_ENABLE_CRM_ASSISTANT === "true";
  return (
    <AppShell profile={profile} pendingCount={pendingCount}>
      {children}
      {assistantEnabled && <CrmAssistant />}
    </AppShell>
  );
}
