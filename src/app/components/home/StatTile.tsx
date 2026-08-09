import Link from "next/link";
import type { ReactNode } from "react";

type StatTileProps = {
  icon: ReactNode;
  value: string | number;
  label: string;
  href: string;
  subLabel?: string;
};

export default function StatTile({ icon, value, label, href, subLabel }: StatTileProps) {
  return (
    <Link
      href={href}
      className="group block border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--navy-900)]"
      style={{
        borderColor: "var(--line)",
        background: "var(--navy-800)",
        borderRadius: "var(--radius)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border" style={{ borderColor: "var(--line)", color: "var(--orange)" }}>
          {icon}
        </span>
      </div>
      <div className="text-3xl font-bold leading-none" style={{ color: "var(--orange)", fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      {subLabel && (
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--muted)" }}>
          {subLabel}
        </div>
      )}
    </Link>
  );
}
