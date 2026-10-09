"use client";

import { Copy, Link as LinkIcon, Smartphone } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { Button, IconButton, Skeleton } from "@/components/ui";
import { useForm } from "@/lib/queries/forms";
import { publicFormUrl, copyToClipboard } from "@/lib/share";
import { qrSvg } from "@/lib/shareQr";
import { ShareHeader } from "./ShareHeader";
import { toast } from "sonner";

export function ShareSkeleton() {
  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-bg px-4">
        <Skeleton className="h-6 w-48" />
      </header>
      <div className="p-8">
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    </div>
  );
}

export function FormShare() {
  const { id } = useParams<{ id: string }>();
  const form = useForm(Number(id));
  const [copied, setCopied] = useState(false);
  const [embedMode, setEmbedMode] = useState<"standard" | "fullpage" | "popup">("standard");

  const url = form.data ? publicFormUrl(form.data.slug) : "";

  const handleCopy = async () => {
    if (!url) return;
    await copyToClipboard(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const qrHtml = useMemo(() => {
    if (!url) return "";
    return qrSvg(url, { size: 160 });
  }, [url]);

  if (form.isPending) return <ShareSkeleton />;
  if (form.isError || !form.data) return <div>Error loading form</div>;

  const embedCode = useMemo(() => {
    if (!url) return "";
    let base = `<div data-tf-live="${url}"></div>\n<script src="${window.location.origin}/embed.js"></script>`;
    if (embedMode === "fullpage") {
      base = `<div data-tf-live="${url}" data-tf-mode="fullpage"></div>\n<script src="${window.location.origin}/embed.js"></script>`;
    } else if (embedMode === "popup") {
      base = `<button id="form-popup-btn">Open Form</button>\n<div data-tf-live="${url}" data-tf-mode="popup" data-tf-launch="form-popup-btn"></div>\n<script src="${window.location.origin}/embed.js"></script>`;
    }
    return base;
  }, [url, embedMode]);

  return (
    <div className="flex h-screen flex-col bg-[#f7f7f8]">
      <ShareHeader form={form.data} />
      
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-normal text-text">Share your form</h2>
          <p className="text-sm text-text-muted">Get the link, QR code, or embed it on your website.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Link & QR */}
          <section className="flex flex-col gap-6 rounded-xl border border-border bg-white p-6 shadow-sm">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">Share link</h3>
              <div className="flex items-center gap-2">
                <div className="flex h-10 flex-1 items-center gap-2 rounded-field border border-border bg-bg-subtle px-3 text-sm text-text-soft">
                  <LinkIcon className="size-4 shrink-0" />
                  <span className="truncate">{url}</span>
                </div>
                <Button onClick={handleCopy} variant={copied ? "secondary" : "primary"}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <hr className="border-border" />

            <div>
              <h3 className="mb-4 text-sm font-semibold text-text">QR Code</h3>
              <div className="flex items-start gap-6">
                <div className="overflow-hidden rounded-xl border border-border bg-white p-2">
                  {qrHtml ? (
                    <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qrHtml)}`} alt="QR Code" width={160} height={160} className="block" />
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 text-sm text-text-muted">
                  <p>Download or screenshot this QR code so respondents can open the form on their phone.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Embed */}
          <section className="flex flex-col gap-6 rounded-xl border border-border bg-white p-6 shadow-sm">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text">Embed in a web page</h3>
              <p className="mb-4 text-sm text-text-muted">Add this form directly to your website.</p>
              
              <div className="mb-4 flex gap-2">
                {(["standard", "fullpage", "popup"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setEmbedMode(mode)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      embedMode === mode 
                        ? "border-text bg-text text-white" 
                        : "border-border text-text-soft hover:bg-bg-subtle"
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>

              <div className="relative rounded-field bg-slate-900 p-4 font-mono text-sm text-slate-300">
                <pre className="overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
                <IconButton
                  label="Copy code"
                  icon={<Copy className="size-4" />}
                  onClick={() => {
                    copyToClipboard(embedCode);
                    toast.success("Embed code copied!");
                  }}
                  className="absolute right-2 top-2 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
