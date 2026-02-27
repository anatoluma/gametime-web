import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<{ players: any[]; teams: any[] }>({ players: [], teams: [] });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults({ players: [], teams: [] });
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      
      const [playersRes, teamsRes] = await Promise.all([
        supabase
          .from("players")
          .select("player_id, first_name, last_name, team_id")
          .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
          .limit(5),
        supabase
          .from("teams")
          .select("team_id, team_name")
          .ilike("team_name", `%${query}%`)
          .limit(5)
      ]);

      setResults({
        players: playersRes.data || [],
        teams: teamsRes.data || []
      });
      setIsSearching(false);
    }, 300); // 300ms debounce to save API calls

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return { results, isSearching };
}