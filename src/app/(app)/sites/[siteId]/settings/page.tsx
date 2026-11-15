import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { PageHead } from "@/components/ui/page-head";
import { AREA_COPY } from "@/lib/sites/copy";
import { getSite } from "@/lib/sites/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings · Studiolo" };

function Row({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="border-b border-line py-3">
      <dt className="text-xs leading-4 font-medium text-ink-2">{label}</dt>
      <dd className="mt-1 text-sm leading-5 text-ink">{children}</dd>
      {hint ? (
        <dd className="mt-1 text-xs leading-4 text-ink-3">{hint}</dd>
      ) : null}
    </div>
  );
}

// Site settings (prompt 08 builds editing; d-site-settings.png). Read-only.
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSite(siteId);
  const supabase = await createClient();
  const { data: seo, error } = await supabase
    .from("sites")
    .select("seo_title, seo_description")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw new Error("Could not load settings.");
  return (
    <>
      <PageHead
        size="responsive"
        title={AREA_COPY.settingsTitle}
        lead={AREA_COPY.settingsLead}
      />
      <div className="grid max-w-[944px] gap-x-12 gap-y-8 min-[900px]:grid-cols-2">
        <section aria-labelledby="settings-general">
          <h2
            id="settings-general"
            className="text-sm leading-5 font-medium text-ink"
          >
            {AREA_COPY.general}
          </h2>
          <dl className="mt-2">
            <Row label={AREA_COPY.siteName}>{site.name}</Row>
            <Row
              label={AREA_COPY.studioloAddress}
              hint={
                site.slugLocked
                  ? AREA_COPY.lockedAfterPublish
                  : AREA_COPY.locksOnPublish
              }
            >
              <span className="inline-flex items-center gap-2">
                {site.slugLocked ? (
                  <Icon name="lock" size={14} className="text-ink-3" />
                ) : null}
                {site.studioloAddress}
              </span>
            </Row>
            <Row label={AREA_COPY.customDomain}>
              <span className="flex items-center justify-between gap-4">
                <span>
                  {site.domain
                    ? `${site.domain.hostname} · ${
                        AREA_COPY.status[
                          site.domain.status as keyof typeof AREA_COPY.status
                        ] ?? site.domain.status
                      }`
                    : AREA_COPY.noDomain}
                </span>
                <Link
                  href={`/sites/${siteId}/settings/domain`}
                  className="inline-flex min-h-11 items-center rounded-control text-sm font-medium text-ink underline-offset-2 hover:underline min-[900px]:min-h-8"
                >
                  {AREA_COPY.manage}
                </Link>
              </span>
            </Row>
            <Row label={AREA_COPY.password}>
              {site.passwordOn ? AREA_COPY.passwordOn : AREA_COPY.passwordOff}
            </Row>
          </dl>
        </section>
        <section aria-labelledby="settings-sharing">
          <h2
            id="settings-sharing"
            className="text-sm leading-5 font-medium text-ink"
          >
            {AREA_COPY.sharing}
          </h2>
          <dl className="mt-2">
            <Row label={AREA_COPY.seoTitle}>
              {seo?.seo_title || (
                <span className="text-ink-3">{AREA_COPY.notSet}</span>
              )}
            </Row>
            <Row label={AREA_COPY.seoDescription}>
              {seo?.seo_description || (
                <span className="text-ink-3">{AREA_COPY.notSet}</span>
              )}
            </Row>
          </dl>
        </section>
      </div>
      <p className="mt-6 text-xs leading-4 text-ink-3">
        {AREA_COPY.settingsNote}
      </p>
    </>
  );
}
