"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getTeamLogoUrl } from "@/lib/team-logo";

type CrestProps = {
  teamId?: string | null;
  teamName?: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

function getInitials(name?: string | null, fallback?: string | null): string {
  const source = (name && name.trim()) || (fallback && fallback.trim()) || "TM";
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return source.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "TM";
}

export default function Crest({ teamId, teamName, logoUrl, size = 26, className = "", imageClassName = "h-[70%] w-[70%] object-contain", fallbackClassName = "text-[10px]" }: CrestProps) {
  const [hasError, setHasError] = useState(false);
  const src = useMemo(() => getTeamLogoUrl(teamId) || logoUrl || "/images/teams/default.svg", [logoUrl, teamId]);
  const initials = useMemo(() => getInitials(teamName, teamId), [teamName, teamId]);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: "var(--line)",
        background: "var(--navy-700)",
      }}
      aria-hidden="true"
    >
      {hasError ? (
        <span className={`${fallbackClassName} font-bold tracking-wide`} style={{ color: "var(--text)" }}>
          {initials}
        </span>
      ) : (
        <Image
          src={src}
          alt={teamName ? `${teamName} logo` : `${teamId ?? "team"} logo`}
          width={size}
          height={size}
          className={imageClassName}
          onError={() => setHasError(true)}
          unoptimized
        />
      )}
    </span>
  );
}
