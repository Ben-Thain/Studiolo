import type { ReactNode } from "react";

export type IconName =
  | "plus"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "check"
  | "lock"
  | "copy"
  | "trash"
  | "ellipsis"
  | "globe"
  | "pencil"
  | "document"
  | "inbox"
  | "chart"
  | "sliders"
  | "image"
  | "person"
  | "plan"
  | "duplicate"
  | "external"
  | "sites"
  | "retry";

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

function Stroke({ d }: { d: string }) {
  return (
    <path
      d={d}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

const glyphs: Record<IconName, ReactNode> = {
  plus: <Stroke d="M8 2.75v10.5M2.75 8h10.5" />,
  "chevron-down": <Stroke d="M3.25 6.25 8 11l4.75-4.75" />,
  "chevron-left": <Stroke d="M10 3.25 5.25 8 10 12.75" />,
  "chevron-right": <Stroke d="M6 3.25 10.75 8 6 12.75" />,
  check: <Stroke d="M3.25 8.25 6.5 11.5 12.75 4.5" />,
  lock: (
    <>
      <Stroke d="M5.25 7.25V5.75a2.75 2.75 0 0 1 5.5 0v1.5" />
      <rect
        x="3.25"
        y="7.25"
        width="9.5"
        height="6.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </>
  ),
  copy: (
    <>
      <rect
        x="5.25"
        y="5.25"
        width="7.5"
        height="7.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <Stroke d="M10.75 5.25V3.75A1.25 1.25 0 0 0 9.5 2.5H3.75A1.25 1.25 0 0 0 2.5 3.75V9.5c0 .69.56 1.25 1.25 1.25H5.25" />
    </>
  ),
  trash: (
    <>
      <Stroke d="M3.25 4.5h9.5" />
      <Stroke d="M6.25 4.5V3.25h3.5V4.5" />
      <Stroke d="M4.5 4.5l.5 8.25h6L11.5 4.5" />
    </>
  ),
  ellipsis: (
    <>
      <circle cx="3.5" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <Stroke d="M2.75 8h10.5M8 2.75c1.4 1.7 2.1 3.45 2.1 5.25S9.4 11.55 8 13.25C6.6 11.55 5.9 9.8 5.9 8S6.6 4.45 8 2.75" />
    </>
  ),
  pencil: <Stroke d="M9.75 3.25 12.75 6.25 6 13H3v-3zM9 4l3 3" />,
  document: (
    <>
      <Stroke d="M4.25 2.75h4.5L12 6.25v7H4.25z" />
      <Stroke d="M8.75 2.75V6.25H12" />
    </>
  ),
  inbox: (
    <Stroke d="M2.75 9.25 4.25 3.75h7.5l1.5 5.5v3.5H2.75zM2.75 9.25h3.1l.9 1.75h2.5l.9-1.75h3.1" />
  ),
  chart: <Stroke d="M3.5 13V8.5M8 13V3.5M12.5 13V6.5" />,
  sliders: (
    <>
      <Stroke d="M2.75 4.5h10.5M2.75 8h10.5M2.75 11.5h10.5" />
      <circle
        cx="6"
        cy="4.5"
        r="1.25"
        fill="var(--bg)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="10"
        cy="8"
        r="1.25"
        fill="var(--bg)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="7"
        cy="11.5"
        r="1.25"
        fill="var(--bg)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </>
  ),
  image: (
    <>
      <rect
        x="2.5"
        y="3.25"
        width="11"
        height="9.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="6" cy="6.25" r="1" fill="currentColor" />
      <Stroke d="M3.5 11.25 6.5 8.5l2 1.75 1.5-1.25L12.5 11" />
    </>
  ),
  person: (
    <>
      <circle cx="8" cy="5.25" r="2" stroke="currentColor" strokeWidth="1.5" />
      <Stroke d="M3.75 13.25c.6-2.3 2.3-3.5 4.25-3.5s3.65 1.2 4.25 3.5" />
    </>
  ),
  plan: (
    <rect
      x="2.75"
      y="3.75"
      width="10.5"
      height="8.5"
      rx="1.25"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  ),
  duplicate: (
    <>
      <rect
        x="5.25"
        y="5.25"
        width="7.25"
        height="7.25"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <Stroke d="M10.75 5.25V3.75c0-.7-.55-1.25-1.25-1.25H3.75c-.7 0-1.25.55-1.25 1.25V9.5c0 .7.55 1.25 1.25 1.25H5.25" />
    </>
  ),
  external: (
    <>
      <Stroke d="M6.5 3.5H3.75A1.25 1.25 0 0 0 2.5 4.75v7.5c0 .7.56 1.25 1.25 1.25h7.5c.7 0 1.25-.55 1.25-1.25V9.5" />
      <Stroke d="M8.5 2.75H13.25V7.5M13 3 7.5 8.5" />
    </>
  ),
  sites: (
    <>
      <rect
        x="2.5"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="2.5"
        width="4.5"
        height="4.5"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="2.5"
        y="9"
        width="4.5"
        height="4.5"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9"
        y="9"
        width="4.5"
        height="4.5"
        rx="0.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </>
  ),
  retry: <Stroke d="M13 8a5 5 0 1 1-1.4-3.45M13 2.75V5.5H10.25" />,
};

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {glyphs[name]}
    </svg>
  );
}
