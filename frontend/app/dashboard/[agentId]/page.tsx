import { DashboardClient } from "@/components/dashboard/dashboard-client";

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function DashboardPage({ params }: PageProps) {
  const { agentId } = await params;
  return <DashboardClient agentId={agentId} />;
}
