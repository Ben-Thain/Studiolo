"use client";

import { useSyncExternalStore } from "react";
import { formatDayMonth, formatLastEdited } from "@/lib/dates";

const noSubscribe = () => () => {};
const viewerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverZone = () => "UTC";

/**
 * A date in the viewer's time zone. The server (and hydration) render UTC;
 * the client then re-renders in the browser's zone without a mismatch.
 */
export function LocalDate({
  iso,
  format,
}: {
  iso: string;
  format: "last-edited" | "day-month";
}) {
  const timeZone = useSyncExternalStore(noSubscribe, viewerZone, serverZone);
  const date = new Date(iso);
  const text =
    format === "last-edited"
      ? formatLastEdited(date, new Date(), timeZone)
      : formatDayMonth(date, timeZone);
  return <time dateTime={iso}>{text}</time>;
}
