import type { Metadata } from "next";
import { Suspense } from "react";
import { FormResults, ResultsSkeleton } from "@/components/results/FormResults";

export const metadata: Metadata = { title: "Results" };

export default function FormResultsPage() {
  // The form id is URL data, so results stream in after the static shell.
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <FormResults />
    </Suspense>
  );
}
