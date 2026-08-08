"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Season } from "@/lib/league";

type Props = {
  seasons: Season[];
  currentSeason: string;
};

export default function SeasonSelector({ seasons, currentSeason }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select
      value={currentSeason}
      onChange={handleChange}
      aria-label="Season"
      className="text-[10px] font-black uppercase tracking-widest bg-gray-100 border-0 rounded-full px-3 py-1.5 text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors appearance-none"
    >
      {seasons.map((s) => (
        <option key={s.season} value={s.season}>
          {s.season}
        </option>
      ))}
    </select>
  );
}
