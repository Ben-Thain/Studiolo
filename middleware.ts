import { NextResponse } from "next/server";

// Passthrough stub. Prompts 03 and 09 add routing in this file.
// Stays middleware.ts so those prompts extend the same module. Next.js 16
// prints a deprecation notice pointing at proxy.ts; the stub still runs.
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
