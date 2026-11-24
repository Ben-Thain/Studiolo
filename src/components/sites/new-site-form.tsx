"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  checkSlug,
  createSite,
  type SlugCheck,
} from "@/app/(app)/sites/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import type { AddressParts } from "@/lib/addresses";
import { SITES_COPY } from "@/lib/sites/copy";
import { deriveSlug, isValidSlug } from "@/lib/sites/slug";
import { cn } from "@/lib/utils";

type Variant = "first" | "dialog";

function slugMessage(check: SlugCheck | null): string | null {
  if (!check) return null;
  if (check.status === "invalid") return SITES_COPY.slugInvalid;
  if (check.status === "reserved") return SITES_COPY.slugReserved;
  if (check.status === "taken") return SITES_COPY.slugTaken;
  return null;
}

/**
 * The New site form, shared by the zero-sites empty state (d-empty.png) and
 * the New site dialog (d-new-site.png): Site name, the slug preview with
 * Edit, the lock hint and Create site. The slug is derived from the name
 * until the user edits it, then never changed for them; it is checked 300ms
 * after it stops changing (invalid, reserved, taken + a "Use …-2"
 * suggestion).
 */
export function NewSiteForm({
  variant,
  parts,
  actions,
  onCancel,
}: {
  variant: Variant;
  parts: AddressParts;
  /** Dialog only: rendered before Create site (Cancel). */
  actions?: ReactNode;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const slugInputId = useId();
  const slugMessageId = useId();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [typedSlug, setTypedSlug] = useState<string | null>(null);
  const [check, setCheck] = useState<{
    slug: string;
    result: SlugCheck;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const request = useRef(0);
  const slugRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const slug = typedSlug ?? (name.trim() ? deriveSlug(name) : "");
  const current = check && check.slug === slug ? check.result : null;
  const slugError = slugMessage(current);
  // Too many checks this minute: a quiet note, not an error. Create site
  // still works (the server checks the address again).
  const slugPaused = current?.status === "rate_limited";

  useEffect(() => {
    if (!slug) return;
    const id = ++request.current;
    const timer = window.setTimeout(async () => {
      if (!isValidSlug(slug)) {
        setCheck({ slug, result: { status: "invalid" } });
        return;
      }
      try {
        const result = await checkSlug(slug);
        if (request.current === id) setCheck({ slug, result });
      } catch {
        // The create action checks again; a failed preview check is quiet.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [slug]);

  useEffect(() => {
    if (editing) slugRef.current?.focus();
  }, [editing]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(SITES_COPY.nameRequired);
      nameRef.current?.focus();
      return;
    }
    if (trimmed.length > 60) {
      setNameError(SITES_COPY.nameTooLong);
      nameRef.current?.focus();
      return;
    }
    setNameError(null);
    if (slugError) {
      setEditing(true);
      slugRef.current?.focus();
      return;
    }
    setPending(true);
    const result = await createSite({ name: trimmed, slug }).catch(
      () =>
        ({ ok: false, field: "form", error: SITES_COPY.createFailed }) as const,
    );
    if (result.ok) {
      router.push(`/sites/${result.siteId}/editor/${result.homePageId}`);
      return;
    }
    setPending(false);
    if (result.field === "name") {
      setNameError(result.error);
      nameRef.current?.focus();
    } else if (result.field === "slug") {
      const status =
        result.error === SITES_COPY.slugReserved
          ? "reserved"
          : result.error === SITES_COPY.slugInvalid
            ? "invalid"
            : "taken";
      setCheck({
        slug,
        result:
          status === "taken"
            ? { status, suggestion: result.suggestion ?? null }
            : { status },
      });
      setEditing(true);
    } else {
      setFormError(result.error);
    }
  }

  const first = variant === "first";
  const suggestion = current?.status === "taken" ? current.suggestion : null;

  return (
    <form onSubmit={submit} noValidate>
      <div className={first ? "mt-8" : "mt-6"}>
        <Field
          label={SITES_COPY.siteName}
          layout="stacked"
          error={nameError ?? undefined}
        >
          <Input
            ref={nameRef}
            size={first ? "block" : undefined}
            value={name}
            maxLength={60}
            autoComplete="off"
            autoFocus={first}
            data-autofocus=""
            {...(first ? { "data-first-site-name": "" } : {})}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
          />
        </Field>
      </div>

      {editing ? (
        <div className="mt-2">
          <label htmlFor={slugInputId} className="sr-only">
            {SITES_COPY.address}
          </label>
          <div
            className={cn(
              "flex items-center rounded-control border border-line bg-bg pr-3 text-ink-3 focus-within:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgba(10,10,10,0.4)]",
              slugError && "border-error",
              "h-12 text-base sm:h-8 sm:text-[13px]",
            )}
          >
            <Icon name="globe" size={14} className="ml-3 shrink-0 text-ink-2" />
            {parts.before ? (
              <span className="ml-2 shrink-0">{parts.before}</span>
            ) : null}
            <input
              id={slugInputId}
              ref={slugRef}
              value={slug}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={slugError ? true : undefined}
              aria-describedby={slugError ? slugMessageId : undefined}
              onChange={(event) => setTypedSlug(event.target.value)}
              className={cn(
                "h-full min-w-0 flex-1 bg-transparent font-medium text-ink outline-none",
                parts.before ? "" : "ml-2",
              )}
            />
            {parts.after ? (
              <span className="shrink-0">{parts.after}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex min-h-6 items-center gap-2 text-[13px] leading-5 max-[899px]:min-h-11">
          <Icon name="globe" size={14} className="shrink-0 text-ink-2" />
          <span
            className="min-w-0 flex-1 truncate text-ink-2"
            data-slug-preview=""
          >
            {parts.before}
            {slug ? (
              <span className="font-medium text-ink">{slug}</span>
            ) : (
              <span className="text-ink-3">your-site</span>
            )}
            {parts.after}
          </span>
          <button
            type="button"
            aria-label={SITES_COPY.editAddress}
            onClick={() => {
              setTypedSlug(slug);
              setEditing(true);
            }}
            className="inline-flex h-6 shrink-0 items-center justify-center rounded-control px-2 text-xs leading-4 font-medium text-ink-2 hover:bg-fill-hover hover:text-ink max-[899px]:h-11 max-[899px]:min-w-11 max-[899px]:text-sm"
          >
            {SITES_COPY.edit}
          </button>
        </div>
      )}

      {slugError ? (
        <div
          id={slugMessageId}
          role="alert"
          className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          <p className="text-xs leading-4 text-error">{slugError}</p>
          {suggestion ? (
            <Button
              type="button"
              variant="secondary"
              size="touch-sm"
              className="sm:h-6 sm:px-2 sm:text-xs"
              onClick={() => {
                setTypedSlug(suggestion);
                setCheck({ slug: suggestion, result: { status: "ok" } });
              }}
            >
              {SITES_COPY.suggestionLabel(suggestion)}
            </Button>
          ) : null}
        </div>
      ) : null}

      {slugPaused ? (
        <p role="status" className="mt-2 text-xs leading-4 text-ink-2">
          {SITES_COPY.slugRateLimited}
        </p>
      ) : null}

      <p className="mt-2 text-xs leading-4 text-ink-3">{SITES_COPY.lockHint}</p>

      {formError ? (
        <p role="alert" className="mt-4 text-xs leading-4 text-error">
          {formError}
        </p>
      ) : null}

      {first ? (
        <Button
          type="submit"
          size="block"
          loading={pending}
          className="mt-6 w-full"
        >
          {SITES_COPY.create}
        </Button>
      ) : (
        <div className="mt-6 flex justify-end gap-2 max-[479px]:flex-col-reverse max-[479px]:items-stretch">
          {actions ?? (
            <Button
              type="button"
              variant="secondary"
              size="touch-sm"
              onClick={onCancel}
              disabled={pending}
            >
              {SITES_COPY.cancel}
            </Button>
          )}
          <Button type="submit" size="touch-sm" loading={pending}>
            {SITES_COPY.create}
          </Button>
        </div>
      )}
    </form>
  );
}
