-- Prompt 03b-fix: profile field limits enforced in the database as well as in
-- the Account page's server actions.

-- display_name: 1 to 80 characters after trimming. The empty string stays
-- allowed because handle_new_user() creates every profile with '' ("not set"
-- until the user adds a name); whitespace-only names are rejected.
alter table public.profiles
  add constraint profiles_display_name_length
  check (
    display_name = ''
    or char_length(btrim(display_name)) between 1 and 80
  );

-- notification_email: null (use the login email) or one plausible address of
-- at most 254 characters. The address is NOT verified: the owner can type any
-- address here. Prompt 12 (form email notifications) must verify it, or send
-- only to the login email, before mailing submissions to it.
alter table public.profiles
  add constraint profiles_notification_email_format
  check (
    notification_email is null
    or (
      char_length(notification_email) <= 254
      and notification_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );
