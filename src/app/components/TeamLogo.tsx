"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { DEFAULT_TEAM_LOGO, resolveTeamLogoUrl } from "@/lib/team-logo";

type TeamLogoProps = {
  teamId: string;
  teamName?: string;
  /** @deprecated Ignored; logos resolve from teamId via resolveTeamLogoUrl(). */
  logoUrl?: string | null;
  className?: string;
  size?: number;
};

export default function TeamLogo({ teamId, teamName, className = "", size = 48 }: TeamLogoProps) {
  const primarySrc = resolveTeamLogoUrl(teamId);
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
      onError={() => setSrc(DEFAULT_TEAM_LOGO)}
      unoptimized
    />
  );
}
