'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadAgent } from '@/lib/agent-store';

export default function DashboardIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const agent = loadAgent();
    if (agent?.id) {
      router.replace(`/dashboard/${agent.id}`);
    } else {
      router.replace('/onboarding');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center font-landing text-sm text-[#9ca3af]">
      Loading dashboard…
    </div>
  );
}
