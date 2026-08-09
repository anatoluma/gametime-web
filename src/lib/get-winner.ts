export type WinnerSide = "home" | "away" | "tie" | "pending";

export function getWinner(homeScore: number | null, awayScore: number | null): WinnerSide {
  if (homeScore === null || awayScore === null) {
    return "pending";
  }

  if (homeScore > awayScore) {
    return "home";
  }

  if (awayScore > homeScore) {
    return "away";
  }

  return "tie";
}
