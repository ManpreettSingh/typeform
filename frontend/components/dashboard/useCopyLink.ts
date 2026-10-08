"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { copyToClipboard, publicFormUrl } from "@/lib/share";

/** Copies a form's public link and reports the result with a toast. */
export function useCopyLink() {
  return useCallback(async (slug: string) => {
    const ok = await copyToClipboard(publicFormUrl(slug));
    if (ok) toast.success("Link copied to clipboard");
    else toast.error("Couldn't copy the link. Copy it manually from the Share dialog.");
  }, []);
}
