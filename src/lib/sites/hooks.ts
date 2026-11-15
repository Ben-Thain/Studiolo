import "server-only";

/**
 * Side effects of site changes that later prompts implement. Callers (create,
 * duplicate, delete, restore) call them now so they never change:
 * - invalidateSiteCaches: prompt 09 (published-site caches).
 * - detachSiteDomain: prompt 11 (removes the custom domain from the Vercel
 *   project and deletes the domains row).
 */

export async function invalidateSiteCaches(siteId: string): Promise<void> {
  void siteId;
}

export async function detachSiteDomain(siteId: string): Promise<void> {
  void siteId;
}
