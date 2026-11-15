import type { ReactNode } from "react";
import { HomeShell } from "@/components/home/home-shell";
import { getHomeContext } from "@/lib/home/data";
import { trialLineText } from "@/lib/trial";

function initialsOf(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

// Home shell for /sites, /account and /plan (prompt 03). Signed-in only: the
// middleware redirects first; getHomeContext's guard is the backstop.
export default async function HomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { email, profile } = await getHomeContext();
  const name = profile.display_name.trim() || email;
  return (
    <HomeShell
      trialText={trialLineText(profile)}
      initials={initialsOf(profile.display_name, email)}
      name={name}
    >
      {children}
    </HomeShell>
  );
}
