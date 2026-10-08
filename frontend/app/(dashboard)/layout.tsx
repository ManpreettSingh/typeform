import { TopNav } from "@/components/dashboard/TopNav";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TopNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
