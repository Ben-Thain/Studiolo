/** Copy shown instead of any raw auth error. */
export const AUTH_COPY = {
  invalidEmail: "Enter a valid email address.",
  unavailable: "Sign-in isn't available right now. Try again later.",
  rateLimited: "Too many sign-in links. Wait a minute, then try again.",
  sendFailed: "We couldn't send the link. Try again.",
  googleFailed: "We couldn't start Google sign-in. Try again.",
} as const;
