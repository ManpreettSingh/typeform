"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { QuestionTypeChip } from "@/components/builder/QuestionTypeChip";
import { useLastDefined } from "@/components/dashboard/useLastDefined";
import { Button, ConfirmDialog, Drawer, IconButton } from "@/components/ui";
import { formatAnswer } from "@/lib/answerFormat";
import { formatFileSize, isWebUrl } from "@/lib/fileUpload";
import { formatDateTime } from "@/lib/format";
import type { Question, ResponseListItem, UploadedFile } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

type Props = {
  response: ResponseListItem | null;
  questions: Question[];
  onClose: () => void;
  /** Newer / older response on the current page; undefined disables the button. */
  onNewer?: () => void;
  onOlder?: () => void;
  onDelete: (response: ResponseListItem) => Promise<unknown>;
  deleting: boolean;
};

/** Every question with this response's answer, formatted per type. */
export function ResponseDrawer({ response: current, questions, onClose, onNewer, onOlder, onDelete, deleting }: Props) {
  // Keep rendering the last response while the drawer animates out.
  const response = useLastDefined(current);
  const [confirming, setConfirming] = useState(false);

  const when = response?.submitted_at ?? response?.started_at;

  return (
    <>
      <Drawer
        open={current !== null}
        onClose={onClose}
        title={when ? formatDateTime(when) : "Response"}
        actions={
          <div className="flex items-center">
            <IconButton label="Newer response" icon={<ChevronUp className="size-4" />} disabled={!onNewer} onClick={onNewer} />
            <IconButton label="Older response" icon={<ChevronDown className="size-4" />} disabled={!onOlder} onClick={onOlder} />
          </div>
        }
        footer={
          <>
            <span className="text-xs text-text-muted">Response #{response?.id}</span>
            <Button
              size="sm"
              variant="dangerGhost"
              leftIcon={<Trash2 className="size-4" aria-hidden />}
              onClick={() => setConfirming(true)}
            >
              Delete
            </Button>
          </>
        }
      >
        {response && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <StatusBadge status={response.status} />
              {response.submitted_at
                ? `Submitted ${formatDateTime(response.submitted_at)}`
                : `Started ${formatDateTime(response.started_at)}, not submitted`}
            </div>

            <ol className="flex flex-col gap-5">
              {questions.map((q, i) => {
                const text = formatAnswer(q, response.answers[q.id]);
                const file = q.type === "file_upload" ? (response.answers[q.id] as UploadedFile | undefined) : undefined;
                return (
                  <li key={q.id} className="flex gap-3">
                    <QuestionTypeChip type={q.type} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm break-words text-text-muted">
                        {i + 1}. {q.title.trim() || "Untitled question"}
                      </p>
                      {file && isWebUrl(file.url) ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-base break-all text-accent hover:underline"
                        >
                          {file.name}
                          <span className="text-xs text-text-muted">({formatFileSize(file.size)})</span>
                        </a>
                      ) : text ? (
                        <p className="mt-1 text-base break-words whitespace-pre-line text-text">{text}</p>
                      ) : (
                        <p className="mt-1 text-sm text-text-muted">No answer</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          if (!response) return;
          // On failure the mutation already showed a toast; keep the dialog open to retry.
          onDelete(response).then(
            () => setConfirming(false),
            () => {},
          );
        }}
        title="Delete this response?"
        message="It will be removed from the results and the summary. This can't be undone."
        confirmLabel="Delete response"
        destructive
        loading={deleting}
      />
    </>
  );
}
