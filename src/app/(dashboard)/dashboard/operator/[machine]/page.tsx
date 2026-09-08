import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Operator machine home. The console now lives at `/dashboard/operator/
 * [machine]/overview`; this route redirects so deep links and the role-home
 * hop keep working as the shell restructures.
 */
export default async function OperatorMachineHome({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const { machine } = await params;
  redirect(`/dashboard/operator/${machine.toLowerCase()}/overview`);
}