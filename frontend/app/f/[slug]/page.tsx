import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicFormLoading, PublicFormView } from "@/components/respondent/PublicFormView";

// The form's own title replaces this once it loads.
export const metadata: Metadata = { title: "Form" };

export default function PublicFormPage() {
  // The slug is URL data, so the form streams in after the static shell.
  return (
    <Suspense fallback={<PublicFormLoading />}>
      <PublicFormView />
    </Suspense>
  );
}
