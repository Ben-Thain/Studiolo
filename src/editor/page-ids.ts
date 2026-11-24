/** Page ids a link may target: stored rows, plus pages created in this save. */
export function allowedPageIds(
  storedIds: Iterable<string>,
  changes: {
    pages?: { upsert?: { id: string }[]; delete?: string[] };
  },
): Set<string> {
  const ids = new Set(storedIds);
  for (const id of changes.pages?.delete ?? []) ids.delete(id);
  for (const row of changes.pages?.upsert ?? []) ids.add(row.id);
  return ids;
}
