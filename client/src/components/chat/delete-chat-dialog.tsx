import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ChatSessionSummary } from "@/types/api";

interface DeleteChatDialogProps {
  session: ChatSessionSummary | null;
  onCancel: () => void;
  // Resolves once deleted; the dialog closes itself via onCancel afterwards.
  onConfirm: (session: ChatSessionSummary) => Promise<void>;
}

export function DeleteChatDialog({
  session,
  onCancel,
  onConfirm,
}: DeleteChatDialogProps) {
  const [deleting, setDeleting] = useState(false);
  // The parent clears `session` the moment the dialog should close, but the
  // fade-out still renders for a moment. Remember the last chat so the text
  // doesn't flash empty.
  const [shown, setShown] = useState(session);
  if (session && session !== shown) setShown(session);

  const confirm = async () => {
    if (!session) return;
    setDeleting(true);
    try {
      await onConfirm(session);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={session !== null}
      onOpenChange={(open) => !open && !deleting && onCancel()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete conversation?</DialogTitle>
          <DialogDescription>
            “{shown?.title}” and all its messages will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
