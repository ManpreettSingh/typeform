"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { publicFormPath, publicFormUrl } from "@/lib/share";
import { useCopyLink } from "./useCopyLink";
import { useLastDefined } from "./useLastDefined";

const noopSubscribe = () => () => {};

export type ShareableForm = { slug: string; title: string };

type Props = { form: ShareableForm | null; onClose: () => void };

export function ShareFormModal({ form: current, onClose }: Props) {
  const form = useLastDefined(current);
  const copyLink = useCopyLink();
  // window.location is client-only; fall back to the path during prerender.
  const url = useSyncExternalStore(
    noopSubscribe,
    () => (form ? publicFormUrl(form.slug) : ""),
    () => (form ? publicFormPath(form.slug) : ""),
  );

  return (
    <Modal open={current !== null} onClose={onClose} title="Share your form">
      {form && (
        <div className="flex flex-col gap-4">
          <p>Anyone with this link can fill in “{form.title}”. No login needed.</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input label="Public link" value={url} readOnly onFocus={(e) => e.target.select()} />
            </div>
            <Button leftIcon={<Copy className="size-4" aria-hidden />} onClick={() => copyLink(form.slug)}>
              Copy
            </Button>
          </div>
          <a
            href={publicFormPath(form.slug)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent hover:underline"
          >
            Open form <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      )}
    </Modal>
  );
}
