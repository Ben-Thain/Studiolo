import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("w-full border-collapse text-left", className)}>
      {children}
    </table>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  highlight = false,
  header = false,
  interactive = false,
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  highlight?: boolean;
  header?: boolean;
  /** The whole row opens something: pair with a `TableRowLink` in a cell. */
  interactive?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-line",
        header ? "h-10" : "h-14",
        interactive && "relative hover:bg-fill-hover",
        // Highlight (#FAFAFA) fades out when it is turned off.
        "transition-colors duration-700 motion-reduce:transition-none",
        highlight && "bg-fill-hover",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 pr-6 text-xs leading-4 font-medium text-ink-3 last:pr-0",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("h-14 pr-6 align-middle last:pr-0", className)}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * A real link whose hit area covers its `interactive` row, so a click
 * anywhere on the row (or Enter on the focused link) opens it. Controls in
 * other cells stay clickable above it with `relative z-10`.
 */
export function TableRowLink({
  href,
  children,
  className,
  id,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Link
      id={id}
      href={href}
      className={cn(
        "outline-none after:absolute after:inset-0 after:content-['']",
        "focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[rgba(10,10,10,0.4)] focus-visible:after:outline-solid",
        className,
      )}
    >
      {children}
    </Link>
  );
}
