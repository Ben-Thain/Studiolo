import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
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
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {
  highlight?: boolean;
  header?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-line",
        header ? "h-10" : "h-14",
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
