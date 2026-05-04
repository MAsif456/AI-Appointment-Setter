/**
 * Layout for clinic detail sub-pages.
 * Acts as a simple pass-through — the individual pages
 * (page.tsx, ai-configuration/page.tsx, etc.) handle their own
 * data fetching, header, and tab rendering.
 */
export default function ClinicDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
