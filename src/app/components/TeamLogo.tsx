"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type TeamLogoProps = {
  teamId: string;
  teamName?: string;
  className?: string;
  size?: number;
};

export default function TeamLogo({ teamId, teamName, className = "", size = 48 }: TeamLogoProps) {
  const normalizedId = useMemo(() => (teamId || "").trim().toLowerCase(), [teamId]);
  const primarySrc = useMemo(() => `/images/teams/${normalizedId}.webp`, [normalizedId]);
  const [src, setSrc] = useState(primarySrc);

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
