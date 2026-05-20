import { Header } from "@/components/layout/header";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Phase 1 — Once
        </p>
        <h1 className="mb-8 text-2xl font-semibold text-zinc-50">
          Register your taxee agent
        </h1>
        <OnboardingForm />
      </main>
    </div>
  );
}
