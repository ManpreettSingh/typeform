import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderSkeleton, FormBuilder } from "@/components/builder/FormBuilder";

export const metadata: Metadata = { title: "Edit form" };

export default function EditFormPage() {
  // The form id is URL data, so the builder streams in after the static shell.
  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <FormBuilder />
    </Suspense>
  );
}
