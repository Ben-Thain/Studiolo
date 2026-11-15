"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { GoogleMark } from "@/components/auth/google-mark";
import { AUTH_COPY } from "@/lib/auth/copy";
import { sendMagicLink, startGoogleSignIn } from "@/lib/auth/actions";
import { authHref } from "@/lib/auth/next";
import { cn } from "@/lib/utils";

export type AuthMode = "login" | "signup" | "expired";

export const RESEND_SECONDS = 30;
const LAST_EMAIL_KEY = "studiolo:last-email";

const COPY: Record<AuthMode, { title: string; lead: string; submit: string }> =
  {
    signup: {
      title: "Create an account",
      lead: "A personal website in 5 minutes.",
      submit: "Continue",
    },
    login: {
      title: "Log in",
      lead: "Use Google, or get a sign-in link by email.",
      submit: "Continue",
    },
    expired: {
      title: "This link has expired",
      lead: "Sign-in links work once. Enter your email and we'll send a new one.",
      submit: "Send a new link",
    },
  };

function rememberEmail(email: string) {
  try {
    window.sessionStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
    // Storage can be unavailable (private mode); prefill is a nicety.
  }
}

function recallEmail(): string {
  try {
    return window.sessionStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function AuthPanel({
  mode,
  next,
  initialEmail = "",
  googleEnabled,
}: {
  mode: AuthMode;
  next: string | null;
  initialEmail?: string;
  /** False when the Supabase project has the Google provider switched off. */
  googleEnabled: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [, startTransition] = useTransition();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // The expired page prefills the address used for the last link sent from
  // this tab (sessionStorage: nothing outlives the tab).
  useEffect(() => {
    if (mode !== "expired" || initialEmail) return;
    const remembered = recallEmail();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from storage after hydration
    if (remembered) setEmail(remembered);
  }, [mode, initialEmail]);

  // Move focus to the new heading when the view changes, and back to the
  // email field when the user returns to the form.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (sentTo) titleRef.current?.focus();
    else emailRef.current?.focus();
  }, [sentTo]);

  async function send(address: string) {
    setFormError(null);
    setFieldError(null);
    setPending("email");
    try {
      const result = await sendMagicLink({ email: address, next });
      if (result.ok) {
        rememberEmail(result.email);
        setSentTo(result.email);
        return true;
      }
      if (result.field === "email") setFieldError(result.message);
      else setFormError(result.message);
    } catch {
      setFormError(AUTH_COPY.sendFailed);
    } finally {
      setPending(null);
    }
    return false;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError(AUTH_COPY.invalidEmail);
      emailRef.current?.focus();
      return;
    }
    void send(value);
  }

  function onGoogle() {
    if (pending) return;
    setFormError(null);
    setPending("google");
    startTransition(async () => {
      try {
        const result = await startGoogleSignIn({ next });
        if (result && !result.ok) {
          setFormError(result.message);
          setPending(null);
        }
      } catch (error) {
        // A redirect to Google is thrown by the action and handled by Next;
        // anything else is a failure.
        if (isRedirectError(error)) throw error;
        setFormError(AUTH_COPY.googleFailed);
        setPending(null);
      }
    });
  }

  if (sentTo) {
    return (
      <CheckInbox
        email={sentTo}
        titleRef={titleRef}
        pending={pending === "email"}
        error={formError}
        onResend={() => send(sentTo)}
        onBack={() => {
          setFormError(null);
          setSentTo(null);
        }}
      />
    );
  }

  const copy = COPY[mode];
  // With the provider off, Supabase would answer with a raw JSON error, so
  // the button says so instead of failing silently (03b wording).
  const googleButton = googleEnabled ? (
    <Button
      variant="secondary"
      size="block"
      className="w-full"
      onClick={onGoogle}
      loading={pending === "google"}
      disabled={pending === "email"}
      icon={<GoogleMark />}
    >
      Continue with Google
    </Button>
  ) : (
    <Button
      variant="secondary"
      size="block"
      className="w-full"
      disabled
      icon={<GoogleMark />}
    >
      {AUTH_COPY.googleUnavailable}
    </Button>
  );

  const emailForm = (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Email" layout="block" error={fieldError ?? undefined}>
        <Input
          ref={emailRef}
          size="block"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldError) setFieldError(null);
          }}
          disabled={pending !== null}
        />
      </Field>
      <Button
        type="submit"
        size="block"
        className="w-full"
        loading={pending === "email"}
        disabled={pending === "google"}
      >
        {copy.submit}
      </Button>
    </form>
  );

  return (
    <AuthColumn>
      <AuthHeading title={copy.title} titleRef={titleRef}>
        {copy.lead}
      </AuthHeading>
      <div className="mt-8 flex flex-col">
        {mode === "expired" ? (
          <>
            {emailForm}
            <Divider />
            {googleButton}
          </>
        ) : (
          <>
            {googleButton}
            <Divider />
            {emailForm}
          </>
        )}
        <FormError message={formError} />
      </div>
      {mode === "expired" ? null : (
        <p className="mt-6 text-sm leading-5 text-ink-3 min-[900px]:text-[13px]">
          {mode === "signup"
            ? "Already have an account? "
            : "New to Studiolo? "}
          <Link
            href={authHref(mode === "signup" ? "/login" : "/signup", next)}
            className="rounded-control font-medium text-ink hover:underline max-[899px]:-my-3 max-[899px]:inline-flex max-[899px]:min-h-11 max-[899px]:min-w-11 max-[899px]:items-center max-[899px]:justify-center"
          >
            {mode === "signup" ? "Log in" : "Create an account"}
          </Link>
        </p>
      )}
    </AuthColumn>
  );
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function CheckInbox({
  email,
  titleRef,
  pending,
  error,
  onResend,
  onBack,
}: {
  email: string;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  pending: boolean;
  error: string | null;
  onResend: () => Promise<boolean>;
  onBack: () => void;
}) {
  // A deadline rather than a decrementing counter, so a throttled background
  // tab still shows the right time when it wakes.
  const [deadline, setDeadline] = useState(
    () => Date.now() + RESEND_SECONDS * 1000,
  );
  const [now, setNow] = useState(() => Date.now());
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [seconds]);

  async function resend() {
    if (await onResend()) {
      const start = Date.now();
      setNow(start);
      setDeadline(start + RESEND_SECONDS * 1000);
    }
  }

  const waiting = seconds > 0;
  return (
    <AuthColumn>
      <AuthHeading title="Check your inbox" titleRef={titleRef}>
        We sent a sign-in link to{" "}
        <span className="font-medium [overflow-wrap:anywhere] text-ink">
          {email}
        </span>
        . Open it on this device.
      </AuthHeading>
      <div className="mt-8 flex flex-col gap-2">
        {waiting ? (
          <Button size="block" className="w-full border border-line" disabled>
            Resend in {seconds}s
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="block"
            className="w-full"
            onClick={resend}
            loading={pending}
          >
            Resend
          </Button>
        )}
        <Button
          variant="ghost"
          size="block"
          className="w-full text-ink-2 enabled:hover:text-ink"
          onClick={onBack}
        >
          Use a different email
        </Button>
        <FormError message={error} />
      </div>
    </AuthColumn>
  );
}

export function AuthColumn({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[408px] px-6 pt-16 pb-16 min-[900px]:pt-[136px]">
      {children}
    </main>
  );
}

function AuthHeading({
  title,
  titleRef,
  children,
}: {
  title: string;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="text-[28px] leading-9 font-medium tracking-[-0.02em] text-ink outline-none min-[900px]:text-2xl min-[900px]:leading-8"
      >
        {title}
      </h1>
      <p className="mt-2 text-base leading-6 text-ink-3 min-[900px]:text-sm min-[900px]:leading-5">
        {children}
      </p>
    </>
  );
}

function Divider() {
  return (
    <div
      className="my-6 flex items-center gap-3"
      role="separator"
      aria-label="or"
    >
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs leading-5 text-ink-3" aria-hidden="true">
        or
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  return (
    <p
      role="alert"
      className={cn(
        "text-center text-sm leading-5 text-error min-[900px]:text-[13px]",
        message ? "mt-4" : "sr-only",
      )}
    >
      {message ?? ""}
    </p>
  );
}
