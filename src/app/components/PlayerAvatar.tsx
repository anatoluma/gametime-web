"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type PlayerAvatarProps = {
  playerId: string;
  playerName?: string;
  photoUrl?: string | null;
  className?: string;
  width?: number;
  height?: number;
};

export default function PlayerAvatar({
  playerId,
  playerName,
  photoUrl,
  className = "",
  width = 72,
  height = 90,
}: PlayerAvatarProps) {
  const normalizedId = useMemo(() => (playerId || "").trim(), [playerId]);
  const primarySrc = useMemo(
    () => photoUrl || `/images/players/${normalizedId}.webp`,
    [photoUrl, normalizedId]
  );
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <Image
      src={src}
      alt={playerName ? `${playerName} profile photo` : `${playerId} profile photo`}
      width={width}
      height={height}
      className={className}
      onError={() => setSrc("/images/players/default.svg")}
      unoptimized
    />
  );
}
