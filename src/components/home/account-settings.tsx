"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  changeLoginEmail,
  signOut,
  updateDisplayName,
  updateNotificationEmail,
  type AccountResult,
} from "@/lib/home/actions";
import { ACCOUNT_COPY, deleteAccountLead } from "@/lib/home/copy";

type EditableRowProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  notice?: string | null;
  action: "Edit" | "Change";
  inputType: "text" | "email";
  initial: string;
  placeholder?: string;
  autoComplete: string;
  onSave: (value: string) => Promise<AccountResult>;
  onSaved?: (result: Extract<AccountResult, { ok: true }>) => void;
};

/**
 * One account row (d-account.png): a 200px label column, the value, and a
 * ghost Edit/Change button that opens an inline field.
 */
function EditableRow({
  label,
  value,
  hint,
  notice,
  action,
  inputType,
  initial,
  placeholder,
  autoComplete,
  onSave,
  onSaved,
}: EditableRowProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const openButton = useRef<HTMLButtonElement>(null);

  const close = () => {
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => openButton.current?.focus());
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSave(draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved?.(result);
      close();
    });
  };

  const formId = `${id}-form`;
  const messageId = `${id}-message`;

  return (
    <div
      className={cn(
        "grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-0.5 border-b border-line py-3 min-[900px]:grid-cols-[200px_minmax(0,1fr)_auto] min-[900px]:gap-y-0",
        hint
          ? "min-[900px]:min-h-16 min-[900px]:pb-[11px]"
          : "min-[900px]:min-h-14 min-[900px]:py-2",
      )}
    >
      <div
        id={`${id}-label`}
        className="text-sm leading-5 text-ink-2 min-[900px]:row-span-1"
      >
        {label}
      </div>
      <div
        className={cn(
          "col-start-1 row-start-2 min-w-0 min-[900px]:col-start-2 min-[900px]:row-start-1",
          // Below 640px the field takes the full width.
          editing && "col-span-2 sm:col-span-1",
        )}
      >
        {editing ? (
          <form id={formId} onSubmit={submit} noValidate className="py-1">
            <Input
              type={inputType}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
              aria-labelledby={`${id}-label`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error || hint ? messageId : undefined}
              autoComplete={autoComplete}
              placeholder={placeholder}
              spellCheck={false}
              autoFocus
              className="sm:max-w-[360px]"
            />
            {error ? (
              <p
                id={messageId}
                role="alert"
                className="mt-1 text-xs leading-4 text-error"
              >
                {error}
              </p>
            ) : hint ? (
              <p id={messageId} className="mt-1 text-xs leading-4 text-ink-3">
                {hint}
              </p>
            ) : null}
          </form>
        ) : (
          <>
            <div className="text-sm leading-5 break-words text-ink">
              {value}
            </div>
            {hint ? (
              <p className="mt-1 text-xs leading-4 text-ink-3">{hint}</p>
            ) : null}
            {notice ? (
              <p role="status" className="mt-0.5 text-xs leading-4 text-ink-2">
                {notice}
              </p>
            ) : null}
          </>
        )}
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 min-[900px]:col-start-3 min-[900px]:row-span-1 min-[900px]:row-start-1",
          editing
            ? // Below 640px, Cancel and Save sit on their own row under the field.
              "col-span-2 col-start-1 row-start-3 pt-2 sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:pt-0 min-[900px]:col-span-1"
            : "col-start-2 row-span-2 row-start-1",
        )}
      >
        {editing ? (
          <>
            <Button
              variant="ghost"
              size="touch-sm"
              onClick={close}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="touch-sm"
              form={formId}
              loading={pending}
            >
              Save
            </Button>
          </>
        ) : (
          <Button
            ref={openButton}
            variant="ghost"
            size="touch-sm"
            aria-label={`${action} ${label.toLowerCase()}`}
            onClick={() => {
              setDraft(initial);
              setError(null);
              setEditing(true);
            }}
          >
            {action}
          </Button>
        )}
      </div>
    </div>
  );
}

export function AccountSettings({
  name,
  loginEmail,
  pendingEmail,
  notificationEmail,
  siteCount,
}: {
  name: string;
  loginEmail: string;
  pendingEmail: string | null;
  notificationEmail: string | null;
  siteCount: number;
}) {
  const router = useRouter();
  const [emailNotice, setEmailNotice] = useState<string | null>(
    pendingEmail ? ACCOUNT_COPY.pendingEmail(pendingEmail) : null,
  );
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, startSignOut] = useTransition();

  return (
    <div className="max-w-[640px]">
      <div className="border-t border-line">
        <EditableRow
          label={ACCOUNT_COPY.name}
          value={name || <span className="text-ink-3">Not set</span>}
          action="Edit"
          inputType="text"
          initial={name}
          autoComplete="name"
          onSave={(value) => updateDisplayName({ name: value })}
          onSaved={() => router.refresh()}
        />
        <EditableRow
          label={ACCOUNT_COPY.loginEmail}
          value={loginEmail}
          notice={emailNotice}
          action="Change"
          inputType="email"
          initial=""
          placeholder={loginEmail}
          autoComplete="email"
          onSave={(value) => changeLoginEmail({ email: value })}
          onSaved={() => setEmailNotice(ACCOUNT_COPY.emailChangeSent)}
        />
        <EditableRow
          label={ACCOUNT_COPY.notifications}
          value={notificationEmail || loginEmail}
          hint={ACCOUNT_COPY.notificationsHint}
          action="Change"
          inputType="email"
          initial={notificationEmail ?? ""}
          placeholder={loginEmail}
          autoComplete="email"
          onSave={(value) => updateNotificationEmail({ email: value })}
          onSaved={() => router.refresh()}
        />
      </div>

      <div className="mt-6">
        <Button
          variant="secondary"
          size="touch-sm"
          icon={<Icon name="sign-out" size={16} />}
          loading={signingOut}
          onClick={() =>
            startSignOut(async () => {
              setSignOutError(null);
              const result = await signOut();
              if (result && !result.ok) setSignOutError(result.message);
            })
          }
        >
          {ACCOUNT_COPY.signOut}
        </Button>
        {signOutError ? (
          <p role="alert" className="mt-2 text-xs leading-4 text-error">
            {signOutError}
          </p>
        ) : null}
      </div>

      <section
        aria-labelledby="delete-account"
        className="mt-10 border-t border-line pt-6"
      >
        <h2
          id="delete-account"
          className="text-sm leading-5 font-medium text-ink"
        >
          {ACCOUNT_COPY.deleteTitle}
        </h2>
        <p className="mt-1 text-sm leading-5 text-ink-3">
          {deleteAccountLead(siteCount)}
        </p>
        {/* Prompt 15 wires this; until then it opens nothing. */}
        <Button
          variant="secondary"
          size="touch-sm"
          aria-disabled="true"
          title={ACCOUNT_COPY.availableSoon}
          className="mt-4 text-error"
        >
          {ACCOUNT_COPY.deleteButton}
        </Button>
      </section>
    </div>
  );
}
