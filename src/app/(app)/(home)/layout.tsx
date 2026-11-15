import type { ReactNode } from "react";
import { HomeShell } from "@/components/home/home-shell";
import { getAccountLine } from "@/lib/home/data";

// Home shell for /sites, /account and /plan (prompt 03). Signed-in only: the
// middleware redirects first; getHomeContext's guard is the backstop.
export default async function HomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { trialText, initials, name } = await getAccountLine();
  return (
    <HomeShell trialText={trialText} initials={initials} name={name}>
      {children}
    </HomeShell>
  );
}
