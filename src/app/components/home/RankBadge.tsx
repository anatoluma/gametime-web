type RankBadgeProps = {
  rank: number;
};

function rankStyle(rank: number) {
  if (rank === 1) {
    return { background: "var(--gold)", color: "#2f2612" };
  }

  if (rank === 2) {
    return { background: "var(--silver)", color: "#26314a" };
  }

  if (rank === 3) {
    return { background: "var(--bronze)", color: "#2f1d11" };
  }

  return null;
}

export default function RankBadge({ rank }: RankBadgeProps) {
  const style = rankStyle(rank);

  if (!style) {
    return <span className="w-6 text-center text-xs font-semibold" style={{ color: "var(--muted)" }}>{rank}</span>;
  }

  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold"
      style={style}
    >
      {rank}
    </span>
  );
}
