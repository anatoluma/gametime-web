"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const pathname = usePathname();

  const Item = ({ href, label }: { href: string; label: string }) => {
    const active =
      pathname === href || pathname.startsWith(href + "/");

    return (
      <Link
        href={href}
        className={`px-4 py-2 rounded-md text-sm font-semibold transition
          ${active ? "bg-gray-200" : "hover:bg-gray-100"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-6 py-3 flex gap-2">
        <Item href="/teams" label="Teams" />
        <Item href="/games" label="Games" />
        <Item href="/leaders" label="Leaders" />
      </div>
    </nav>
  );
}
