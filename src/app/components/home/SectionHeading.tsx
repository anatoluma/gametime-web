import Link from "next/link";

type SectionHeadingProps = {
  title: string;
  href: string;
  linkLabel: string;
  headingClassName?: string;
};

export default function SectionHeading({ title, href, linkLabel, headingClassName = "" }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className={`lbm-section-heading text-xl font-semibold uppercase leading-none ${headingClassName}`}>{title}</h2>
      <Link
        href={href}
        className="text-xs font-semibold uppercase tracking-[0.08em] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[var(--orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
        style={{ color: "var(--orange)" }}
      >
        {linkLabel}
      </Link>
    </div>
  );
}
