import {
  cloneElement,
  type ComponentPropsWithRef,
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
  "w-full rounded-control border border-line bg-bg px-3 text-ink placeholder:text-ink-3 focus-visible:border-ink disabled:bg-surface-2 disabled:text-ink-4 aria-invalid:border-error";

const responsiveHeight = "h-12 text-base sm:h-8 sm:text-sm";

/**
 * desktop: 32px. touch: 48px. block: the full-width auth and landing controls,
 * 48px with 16px text below 900px and 40px with 14px text from 900px.
 * Unset: 48px below 640px, 32px from 640px.
 */
export type ControlSize = "desktop" | "touch" | "block";

function heightClass(size?: ControlSize) {
  if (size === "touch") return "h-12 text-base";
  if (size === "desktop") return "h-8 text-sm";
  if (size === "block")
    return "h-12 text-base min-[900px]:h-10 min-[900px]:text-sm";
  return responsiveHeight;
}

type Sized = { size?: ControlSize; touch?: boolean };

function resolveSize(
  size?: ControlSize,
  touch?: boolean,
): ControlSize | undefined {
  if (size) return size;
  if (touch) return "touch";
  return undefined;
}

export function Input({
  size,
  touch = false,
  className,
  ...props
}: Omit<ComponentPropsWithRef<"input">, "size"> & Sized) {
  return (
    <input
      className={cn(
        controlClass,
        heightClass(resolveSize(size, touch)),
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  size,
  touch = false,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Sized) {
  const resolved = resolveSize(size, touch);
  return (
    <textarea
      className={cn(
        controlClass,
        "min-h-20 py-2",
        resolved === "touch"
          ? "text-base"
          : resolved === "desktop"
            ? "text-sm"
            : "text-base sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

type FieldChildProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  /**
   * block: the auth forms. 8px between label and control; the label is 14px
   * below 900px and 12px from 900px. Default: 4px gap, 12px label.
   */
  layout?: "default" | "block";
  children: ReactElement<FieldChildProps>;
};

export function Field({
  label,
  hint,
  error,
  layout = "default",
  children,
}: FieldProps) {
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
    <div
      className={cn("flex flex-col", layout === "block" ? "gap-2" : "gap-1")}
    >
      <label
        htmlFor={id}
        className={cn(
          layout === "block" ? "text-sm min-[900px]:text-xs" : "text-xs",
          "leading-4 font-medium text-ink-2",
        )}
      >
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

type LockedInputProps = {
  value: string;
  label: string;
  size?: ControlSize;
  touch?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function LockedInput({
  value,
  label,
  size,
  touch = false,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: LockedInputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-control border border-line bg-fill-hover px-3 text-ink-2 focus-within:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgba(10,10,10,0.4)]",
        heightClass(resolveSize(size, touch)),
      )}
    >
      <Icon name="lock" size={16} />
      <input
        id={id}
        readOnly
        value={value}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={id ? undefined : label}
        className="h-full min-w-0 flex-1 bg-transparent text-ink-2 outline-none"
      />
    </div>
  );
}

export function InputWithSuffix({
  value,
  suffix,
  size,
  touch = false,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> &
  Sized & { suffix: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center rounded-control border border-line bg-bg pr-3 focus-within:border-ink focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[rgba(10,10,10,0.4)]",
        props["aria-invalid"] && "border-error",
        heightClass(resolveSize(size, touch)),
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
