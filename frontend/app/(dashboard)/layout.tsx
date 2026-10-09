import { SectionTabs } from "@/components/dashboard/SectionTabs";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { TopNav } from "@/components/dashboard/TopNav";

/** Typeform's workspace shell: white top bar, then a rounded light frame holding section tabs + content. */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-workspace-shell className="flex h-dvh flex-col bg-bg">
      <TopNav />
      <OnboardingGate />
      <div className="mx-1.5 mb-1.5 flex min-h-0 flex-1 flex-col rounded-card bg-bg-subtle">
        <SectionTabs />
        <main className="flex min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
