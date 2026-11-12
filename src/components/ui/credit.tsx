type CreditProps = {
  href?: string;
};

export function StudioloCredit({
  href = "https://studiolo.page",
}: CreditProps) {
  return (
    <a
      href={href}
      rel="noopener"
      className="flex min-h-11 items-center justify-center text-[13px] leading-5 font-normal text-ink-3 hover:text-ink focus-visible:text-ink"
    >
      Made with Studiolo
    </a>
  );
}
