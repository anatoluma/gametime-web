import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { isExcludedTeamName } from "@/lib/league";

interface SearchPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  team_id: string;
  teams?: {
    team_name: string | null;
  } | null;
}

interface SearchTeam {
  team_id: string;
  team_name: string;
}

interface SearchResults {
  players: SearchPlayer[];
  teams: SearchTeam[];
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<SearchResults>({ players: [], teams: [] });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      setResults({ players: [], teams: [] });
      setIsSearching(false);
      return;
    }

    let isActive = true;

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      
      const [playersRes, teamsRes] = await Promise.all([
        supabase
          .from("players")
          .select("player_id, first_name, last_name, team_id, teams ( team_name )")
          .or(`first_name.ilike.%${normalizedQuery}%,last_name.ilike.%${normalizedQuery}%`)
          .limit(5),
        supabase
          .from("teams")
          .select("team_id, team_name")
          .ilike("team_name", `%${normalizedQuery}%`)
          .limit(5)
      ]);

      if (!isActive) return;

      const players = ((playersRes.data as SearchPlayer[]) || []).filter(
        (player) => !isExcludedTeamName(player.teams?.team_name)
      );
      const teams = ((teamsRes.data as SearchTeam[]) || []).filter(
        (team) => !isExcludedTeamName(team.team_name)
      );

      setResults({
        players,
        teams
      });
      setIsSearching(false);
    }, 300); // 300ms debounce to save API calls

    return () => {
      isActive = false;
      clearTimeout(delayDebounceFn);
    };
  }, [query]);

  return { results, isSearching };
}