import type { Metadata } from "next";
import { TemplatesGallery } from "@/components/templates/TemplatesGallery";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <Suspense>
      <TemplatesGallery />
    </Suspense>
  );
}
