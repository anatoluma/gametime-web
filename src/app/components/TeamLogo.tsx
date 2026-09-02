"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type TeamLogoProps = {
  teamId: string;
  teamName?: string;
  logoUrl?: string | null;
  className?: string;
  size?: number;
};

export default function TeamLogo({ teamId, teamName, logoUrl, className = "", size = 48 }: TeamLogoProps) {
  const normalizedId = useMemo(() => (teamId || "").trim().toLowerCase(), [teamId]);
  const primarySrc = useMemo(() => {
    if (logoUrl) return logoUrl;
    if (normalizedId === "bld") {
      return "/images/teams/bld_new.webp";
    }
    return `/images/teams/${normalizedId}.webp`;
  }, [logoUrl, normalizedId]);
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <Image
      src={src}
      alt={teamName ? `${teamName} logo` : `${teamId} logo`}
      width={size}
      height={size}
      className={className}
      onError={() => setSrc("/images/teams/default.svg")}
      unoptimized
    />
  );
}
