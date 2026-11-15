import type { Metadata } from "next";
import { AccountSettings } from "@/components/home/account-settings";
import { PageHead } from "@/components/ui/page-head";
import { ACCOUNT_COPY } from "@/lib/home/copy";
import { countSites, getHomeContext } from "@/lib/home/data";

export const metadata: Metadata = { title: "Account · Studiolo" };

export default async function AccountPage() {
  const [{ email, newEmail, profile }, siteCount] = await Promise.all([
    getHomeContext("/account"),
    countSites(),
  ]);
  return (
    <>
      <PageHead
        size="responsive"
        title={ACCOUNT_COPY.title}
        lead={ACCOUNT_COPY.lead}
      />
      <AccountSettings
        name={profile.display_name}
        loginEmail={email}
        pendingEmail={newEmail}
        notificationEmail={profile.notification_email}
        siteCount={siteCount}
      />
    </>
  );
}
