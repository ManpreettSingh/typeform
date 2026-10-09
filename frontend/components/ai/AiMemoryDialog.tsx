"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal, Textarea } from "@/components/ui";
import { getErrorMessage } from "@/lib/api";
import { AI_MEMORY_MAX } from "@/lib/ai/types";
import { aiChatApi } from "@/lib/queries/aiChat";

const MEMORY_KEY = ["ai", "memory"] as const;

/** Typeform AI's memory: up to 2,000 characters about you or your business that it keeps in mind. */
export function AiMemoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const memory = useQuery({ queryKey: MEMORY_KEY, queryFn: aiChatApi.memory, enabled: open, staleTime: 0 });
  // null = not edited yet: the field shows what the server has.
  const [edited, setEdited] = useState<string | null>(null);
  const saved = memory.data?.content ?? "";
  const value = edited ?? saved;

  const save = useMutation({
    mutationFn: (content: string) => aiChatApi.saveMemory(content),
    onSuccess: (m) => {
      queryClient.setQueryData(MEMORY_KEY, m);
      toast.success("Memory saved");
      close();
    },
    onError: (e) => toast.error(`Couldn't save your memory. ${getErrorMessage(e)}`),
  });

  function close() {
    setEdited(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Memory"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate(value.trim())}
            loading={save.isPending}
            disabled={memory.isPending || value.trim() === saved}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-muted">
          Tell Typeform AI about yourself or your business: what you do, who your audience is, the tone you like. It keeps this in mind when it
          creates or edits forms.
        </p>
        {memory.isError && <p role="alert" className="text-sm text-danger">Couldn&rsquo;t load your memory. {getErrorMessage(memory.error)}</p>}
        <Textarea
          label="What should Typeform AI remember?"
          rows={6}
          maxLength={AI_MEMORY_MAX}
          disabled={memory.isPending}
          value={value}
          onChange={(e) => setEdited(e.target.value)}
          placeholder="e.g. We run a small bakery in Lisbon. Our customers are locals; keep a warm, casual tone."
        />
        <p className="text-right text-xs text-text-muted tabular-nums">
          {value.length} / {AI_MEMORY_MAX}
        </p>
      </div>
    </Modal>
  );
}
