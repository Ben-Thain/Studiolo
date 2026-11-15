import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

// One toast provider for the signed-in app, so a toast raised on one screen
// (e.g. Duplicate) survives the navigation it triggers.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
