"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type PlayerAvatarProps = {
  playerId: string;
  playerName?: string;
  className?: string;
  width?: number;
  height?: number;
};

export default function PlayerAvatar({
  playerId,
  playerName,
  className = "",
  width = 72,
  height = 90,
}: PlayerAvatarProps) {
  const normalizedId = useMemo(() => (playerId || "").trim(), [playerId]);
  const primarySrc = useMemo(() => `/images/players/${normalizedId}.webp`, [normalizedId]);
  const [src, setSrc] = useState(primarySrc);

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
