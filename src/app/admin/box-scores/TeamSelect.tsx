"use client";

import { useState, useEffect } from "react";

type Team = {
  team_id: string;
  team_name: string | null;
};

type TeamSelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  teams: Team[];
  disabled?: boolean;
};

export default function TeamSelect({ value, onChange, placeholder, teams, disabled }: TeamSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredTeams = teams.filter((team) => 
    team.team_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (team.team_name && team.team_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedTeam = teams.find(t => t.team_id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest('.team-select')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="team-select relative">
      <div
        className={`flex items-center justify-between rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm cursor-pointer focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--accent)] ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={value ? 'text-[var(--foreground)]' : 'text-[var(--text-muted)]'}>
          {selectedTeam ? `${selectedTeam.team_id}${selectedTeam.team_name ? ` — ${selectedTeam.team_name}` : ''}` : placeholder}
        </span>
        <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-[var(--border)]">
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredTeams.length === 0 ? (
              <div className="p-2 text-sm text-[var(--text-muted)]">No teams found</div>
            ) : (
              filteredTeams.map((team) => (
                <div
                  key={team.team_id}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-[var(--surface-muted)] ${value === team.team_id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--foreground)]'}`}
                  onClick={() => {
                    onChange(team.team_id);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <div className="font-medium">{team.team_id}</div>
                  {team.team_name && (
                    <div className="text-xs text-[var(--text-muted)]">{team.team_name}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
