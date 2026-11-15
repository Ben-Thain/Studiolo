"use client";

import { useEffect, useSyncExternalStore } from "react";

export const lastPageKey = (siteId: string) => `studiolo:lastPage:${siteId}`;

/**
 * The editor link for a site: the last page opened in the editor
 * (localStorage['studiolo:lastPage:'+siteId]) if it still exists, else home.
 */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readLastPage(siteId: string): string | null {
  try {
    return window.localStorage.getItem(lastPageKey(siteId));
  } catch {
    return null;
  }
}

export function useEditorHref(
  siteId: string,
  homePageId: string,
  pageIds: string[],
): string {
  const stored = useSyncExternalStore(
    subscribe,
    () => readLastPage(siteId),
    () => null,
  );
  const pageId = stored && pageIds.includes(stored) ? stored : homePageId;
  return `/sites/${siteId}/editor/${pageId}`;
}

/** Remember the page opened in the editor. */
export function RememberLastPage({
  siteId,
  pageId,
}: {
  siteId: string;
  pageId: string;
}) {
  useEffect(() => {
    try {
      window.localStorage.setItem(lastPageKey(siteId), pageId);
    } catch {
      // Private mode or storage full: Open editor falls back to home.
    }
  }, [siteId, pageId]);
  return null;
}
