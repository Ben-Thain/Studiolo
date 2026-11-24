"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSite, restoreSite } from "@/app/(app)/sites/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { SITES_COPY } from "@/lib/sites/copy";

const UNDO_MS = 10_000;

/**
 * Delete site dialog (d-delete-site.png, d-delete-site-domain.png).
 */
export function DeleteSiteDialog({
  siteId,
  name,
  hasDomain,
  open,
  onClose,
  returnFocus,
  onDeleted,
}: {
  siteId: string;
  name: string;
  hasDomain: boolean;
  open: boolean;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null | undefined;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  function dismiss() {
    setTyped("");
    onClose();
  }

  const lead = hasDomain
    ? `${SITES_COPY.deleteLead(name)} ${SITES_COPY.deleteLeadDomain}`
    : SITES_COPY.deleteLead(name);

  async function confirm() {
    if (busy || typed.trim() !== name) return;
    setBusy(true);
    const result = await deleteSite(siteId).catch(() => ({
      ok: false as const,
      error: SITES_COPY.deleteFailed,
    }));
    setBusy(false);
    if (!result.ok) {
      toast({ message: result.error, region: "home" });
      return;
    }
    dismiss();
    onDeleted?.();
    router.push("/sites");
    router.refresh();
    toast({
      message: SITES_COPY.deleted(result.name),
      duration: UNDO_MS,
      region: "home",
      action: {
        label: SITES_COPY.undo,
        onClick: () => {
          void restoreSite(result.siteId).then((restored) => {
            if (!restored.ok) {
              toast({ message: restored.error, region: "home" });
              router.refresh();
              return;
            }
            const message = restored.slugChanged
              ? SITES_COPY.restoredRenamed(restored.name, restored.address)
              : SITES_COPY.restored(restored.name);
            router.push(`/sites?highlight=${restored.siteId}`, { scroll: false });
            router.refresh();
            toast({
              message,
              region: "home",
              action: {
                label: SITES_COPY.openEditor,
                onClick: () => router.push(`/sites/${restored.siteId}`),
              },
            });
          });
        },
      },
    });
  }

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      returnFocus={returnFocus}
      title={SITES_COPY.deleteTitle(name)}
      lead={lead}
      actions={
        <>
          <Button variant="secondary" onClick={dismiss} disabled={busy}>
            {SITES_COPY.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={typed.trim() !== name || busy}
            loading={busy}
            onClick={confirm}
          >
            {SITES_COPY.deleteSite}
          </Button>
        </>
      }
    >
      <div className="mt-4">
        <Field label={SITES_COPY.deleteConfirmLabel(name)}>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>
    </Dialog>
  );
}