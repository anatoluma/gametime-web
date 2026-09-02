"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTeamLogoUrl } from "@/lib/team-logo";

type TeamLogoProps = {
  teamId: string;
  teamName?: string;
  logoUrl?: string | null;
  className?: string;
  size?: number;
};

export default function TeamLogo({ teamId, teamName, logoUrl, className = "", size = 48 }: TeamLogoProps) {
  const primarySrc = getTeamLogoUrl(teamId) || logoUrl || "/images/teams/default.svg";
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
