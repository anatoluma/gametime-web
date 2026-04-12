export const TEAM_CODE_MAP: Record<string, string> = {
  // direct matches
  ADM: "ADM",
  ALU: "ALU",
  AMB: "AMB",
  BLD: "BLD",
  BRI: "BRI",
  CAS: "CAS",
  DRO: "DRO",
  EDI: "EDI",
  GTM: "GTM",
  HAI: "HAI",
  MET: "MET",
  USM: "USM",
  VET: "VET",
  WOL: "WOL",
  // known box score variants
  EDB: "EDI",
  EDN: "EDI",
  BCV: "VET",
  BCB: "BLD",
  HTC: "HAI",
  HIT: "HAI",
  GTB: "GTM",
  GMT: "GTM",
  CAN: "CAS",
  DBC: "DRO",
  BRC: "BRI",
  WWO: "WOL",
  WHI: "WOL",
  WW:  "WOL",
};

export function resolveTeamId(extractedCode: string | null): string | null {
  if (!extractedCode) return null;
  const normalized = extractedCode.trim().toUpperCase();
  const resolved = TEAM_CODE_MAP[normalized] ?? null;
  if (!resolved) console.warn(`[resolveTeamId] Unknown team code: "${extractedCode}"`);
  return resolved;
}
