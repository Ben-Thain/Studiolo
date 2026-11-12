import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icons";

const controlClass =
  "w-full rounded-control border border-line bg-bg px-3 text-ink placeholder:text-ink-3 disabled:bg-surface-2 disabled:text-ink-disabled aria-invalid:border-error";

type Touchable = { touch?: boolean };

export function Input({
  touch = false,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & Touchable) {
  return (
    <input
      className={cn(
        controlClass,
        touch ? "h-12 text-base" : "h-8 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  touch = false,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Touchable) {
  return (
    <textarea
      className={cn(
        controlClass,
        "min-h-20 py-2",
        touch ? "text-base" : "text-sm",
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
};

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })
    : children;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs leading-4 font-medium text-ink-2">
        {label}
      </label>
      {control}
      {error ? (
        <p id={messageId} className="text-xs leading-4 text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs leading-4 text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function LockedInput({
  value,
  touch = false,
  label,
}: {
  value: string;
  touch?: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-control border border-line bg-fill-hover px-3 text-ink-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgba(10,10,10,0.4)]",
        touch ? "h-12 text-base" : "h-8 text-sm",
      )}
    >
      <Icon name="lock" size={16} />
      <input
        readOnly
        value={value}
        aria-label={label}
        className="h-full min-w-0 flex-1 bg-transparent text-ink-2 outline-none"
      />
    </div>
  );
}

export function InputWithSuffix({
  value,
  suffix,
  touch = false,
  onChange,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & Touchable & { suffix: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center rounded-control border border-line bg-bg pr-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgba(10,10,10,0.4)]",
        props["aria-invalid"] && "border-error",
        touch ? "h-12 text-base" : "h-8 text-sm",
      )}
    >
      <input
        value={value}
        onChange={onChange}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-ink outline-none placeholder:text-ink-3"
        {...props}
      />
      <span className="shrink-0 text-ink-3">{suffix}</span>
    </div>
  );
}
