"use client";

import { useSyncExternalStore } from "react";

export function useClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
