import type { Metadata } from "next";
import { FormsDashboard } from "@/components/dashboard/FormsDashboard";

export const metadata: Metadata = { title: "My workspace" };

export default function FormsPage() {
  return <FormsDashboard />;
}
