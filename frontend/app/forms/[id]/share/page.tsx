import type { Metadata } from "next";
import { Suspense } from "react";
import { FormShare, ShareSkeleton } from "@/components/share/FormShare";

export const metadata: Metadata = { title: "Share" };

export default function FormSharePage() {
  return (
    <Suspense fallback={<ShareSkeleton />}>
      <FormShare />
    </Suspense>
  );
}
