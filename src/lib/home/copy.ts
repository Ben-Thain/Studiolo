/** Account page messages (prompt 03). */
export const ACCOUNT_COPY = {
  title: "Account",
  lead: "Your profile and sign-in. Each site has its own settings.",
  name: "Name",
  loginEmail: "Login email",
  notifications: "Form notifications",
  notificationsHint: "Submissions from all sites go here.",
  emailChangeSent: "Check both inboxes to confirm the change",
  pendingEmail: (email: string) => `Waiting for confirmation: ${email}`,
  nameRequired: "Enter your name.",
  nameTooLong: "Use 80 characters or fewer.",
  invalidEmail: "Enter a valid email address.",
  sameEmail: "That's already your login email.",
  emailUnavailable: "That email can't be used. Try another.",
  rateLimited: "Too many attempts. Wait a minute and try again.",
  saveFailed: "We couldn't save that. Try again.",
  signOut: "Sign out",
  signOutFailed: "We couldn't sign you out. Try again.",
  deleteTitle: "Delete account",
  deleteButton: "Delete account",
  availableSoon: "Available soon",
} as const;

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/** "Removes all three sites, their images, submissions and domains. …" */
export function deleteAccountLead(siteCount: number): string {
  const end = "This can't be undone.";
  if (siteCount <= 0) return `Removes your account. ${end}`;
  if (siteCount === 1) {
    return `Removes your site, its images, submissions and domain. ${end}`;
  }
  const count = NUMBER_WORDS[siteCount] ?? String(siteCount);
  return `Removes all ${count} sites, their images, submissions and domains. ${end}`;
}

/** Home shell and Sites list (prompt 03). */
export const HOME_COPY = {
  sitesTitle: "Sites",
  sitesLead: "Open a site to edit it.",
  newSite: "New site",
  availableSoon: "Available soon",
  loadFailed: "We couldn't load this page.",
  columns: {
    site: "Site",
    status: "Status",
    domain: "Domain",
    lastEdited: "Last edited",
    actions: "Actions",
  },
  live: "Live",
  draft: "Draft",
  passwordOn: "Password on",
  menu: {
    duplicate: "Duplicate",
    viewLive: "View live",
    delete: "Delete",
    label: (name: string) => `Actions for ${name}`,
  },
} as const;
