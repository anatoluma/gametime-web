export type ValidationSeverity = "hard" | "soft";

export type ValidationCheck = {
	rule_id: string;
	severity: ValidationSeverity;
	passed: boolean;
	detail: string;
};

type ValidationOptions = {
	duplicateGameExists?: boolean;
};

type PlayerStats = {
	min?: string | null;
	fg_made?: number | null;
	fg_att?: number | null;
	two_made?: number | null;
	two_att?: number | null;
	three_made?: number | null;
	three_att?: number | null;
	ft_made?: number | null;
	ft_att?: number | null;
	fouls_drawn?: number | null;
	efficiency?: number | null;
	points?: number | null;
	[key: string]: unknown;
};

type ExtractedPlayer = {
	team_code?: string | null;
	name?: string | null;
	number?: number | null;
	dnp?: boolean | null;
	stats?: PlayerStats | null;
};

type TeamTotalsRow = {
	team_code?: string | null;
	stats?: {
		points?: number | null;
	} | null;
};

type ScoreByPeriods = {
	home?: {
		intervals?: number[] | null;
	} | null;
	away?: {
		intervals?: number[] | null;
	} | null;
};

type ExtractionPayload = {
	home_team?: {
		code?: string | null;
		score?: number | null;
	} | null;
	away_team?: {
		code?: string | null;
		score?: number | null;
	} | null;
	score_by_periods?: ScoreByPeriods | null;
	players?: ExtractedPlayer[] | null;
	team_totals?: TeamTotalsRow[] | null;
};

function toNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isMonotonicIncreasing(values: number[]): boolean {
	for (let i = 1; i < values.length; i += 1) {
		if (values[i] < values[i - 1]) {
			return false;
		}
	}
	return true;
}

function getPlayersForTeam(players: ExtractedPlayer[], teamCode: string | null): ExtractedPlayer[] {
	if (!teamCode) {
		return [];
	}
	return players.filter((p) => p.team_code === teamCode);
}

function makeCheck(
	rule_id: string,
	severity: ValidationSeverity,
	passed: boolean,
	detail: string
): ValidationCheck {
	return { rule_id, severity, passed, detail };
}

function playerLabel(player: ExtractedPlayer): string {
	const number = toNumber(player.number);
	const name = isNonEmptyString(player.name) ? player.name : "Unknown";
	return number !== null ? `#${number} ${name}` : name;
}

export function validateExtraction(
	extraction_json: unknown,
	options?: ValidationOptions
): ValidationCheck[] {
	const payload = (extraction_json ?? {}) as ExtractionPayload;

	const players = Array.isArray(payload.players) ? payload.players : [];
	const totals = Array.isArray(payload.team_totals) ? payload.team_totals : [];

	const homeCode = payload.home_team?.code ?? null;
	const awayCode = payload.away_team?.code ?? null;
	const homeScore = toNumber(payload.home_team?.score);
	const awayScore = toNumber(payload.away_team?.score);

	const homePlayers = getPlayersForTeam(players, homeCode);
	const awayPlayers = getPlayersForTeam(players, awayCode);

	const sumPoints = (teamPlayers: ExtractedPlayer[]): number =>
		teamPlayers.reduce((acc, p) => acc + (toNumber(p.stats?.points) ?? 0), 0);

	const homePointsSum = sumPoints(homePlayers);
	const awayPointsSum = sumPoints(awayPlayers);

	const totalPointsForCode = (code: string | null): number | null => {
		if (!code) {
			return null;
		}
		const row = totals.find((item) => item.team_code === code);
		return toNumber(row?.stats?.points);
	};

	const homeTotalPoints = totalPointsForCode(homeCode);
	const awayTotalPoints = totalPointsForCode(awayCode);

	const homeIntervalsRaw = payload.score_by_periods?.home?.intervals;
	const awayIntervalsRaw = payload.score_by_periods?.away?.intervals;

	const homeIntervals = Array.isArray(homeIntervalsRaw)
		? homeIntervalsRaw.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
		: [];
	const awayIntervals = Array.isArray(awayIntervalsRaw)
		? awayIntervalsRaw.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
		: [];

	// Derive q4 from the last interval value — more reliable than asking Claude to map it
	const homeQ4 = homeIntervals.length > 0 ? homeIntervals[homeIntervals.length - 1] : null;
	const awayQ4 = awayIntervals.length > 0 ? awayIntervals[awayIntervals.length - 1] : null;

	const checks: ValidationCheck[] = [];

	checks.push(
		makeCheck(
			"points_sum_home",
			"hard",
			homeScore !== null && homePointsSum === homeScore,
			homeScore === null
				? "home_team.score missing"
				: `${homePointsSum} == ${homeScore}`
		)
	);

	checks.push(
		makeCheck(
			"points_sum_away",
			"hard",
			awayScore !== null && awayPointsSum === awayScore,
			awayScore === null
				? "away_team.score missing"
				: `${awayPointsSum} == ${awayScore}`
		)
	);

	checks.push(
		makeCheck(
			"totals_row_home",
			"hard",
			homeScore !== null && homeTotalPoints !== null && homeTotalPoints === homeScore,
			homeScore === null || homeTotalPoints === null
				? "home team total points or home score missing"
				: `${homeTotalPoints} == ${homeScore}`
		)
	);

	checks.push(
		makeCheck(
			"totals_row_away",
			"hard",
			awayScore !== null && awayTotalPoints !== null && awayTotalPoints === awayScore,
			awayScore === null || awayTotalPoints === null
				? "away team total points or away score missing"
				: `${awayTotalPoints} == ${awayScore}`
		)
	);

	checks.push(
		makeCheck(
			"q4_end_home",
			"hard",
			homeScore !== null && homeQ4 !== null && homeQ4 === homeScore,
			homeScore === null || homeQ4 === null
				? "home intervals missing or home score missing"
				: `intervals[-1]=${homeQ4} == ${homeScore}`
		)
	);

	checks.push(
		makeCheck(
			"q4_end_away",
			"hard",
			awayScore !== null && awayQ4 !== null && awayQ4 === awayScore,
			awayScore === null || awayQ4 === null
				? "away intervals missing or away score missing"
				: `intervals[-1]=${awayQ4} == ${awayScore}`
		)
	);

	checks.push(
		makeCheck(
			"intervals_monotonic_home",
			"soft",
			homeIntervals.length > 0 && isMonotonicIncreasing(homeIntervals),
			homeIntervals.length > 0
				? `home intervals: [${homeIntervals.join(", ")}]`
				: "home intervals missing"
		)
	);

	checks.push(
		makeCheck(
			"intervals_monotonic_away",
			"soft",
			awayIntervals.length > 0 && isMonotonicIncreasing(awayIntervals),
			awayIntervals.length > 0
				? `away intervals: [${awayIntervals.join(", ")}]`
				: "away intervals missing"
		)
	);

	const impossibleRule = (
		ruleId: string,
		madeKey: keyof PlayerStats,
		attKey: keyof PlayerStats
	): ValidationCheck => {
		const offenders = players
			.filter((p) => !p.dnp)
			.filter((p) => {
				const made = toNumber(p.stats?.[madeKey]);
				const att = toNumber(p.stats?.[attKey]);
				return made !== null && att !== null && made > att;
			})
			.map((p) => {
				const made = toNumber(p.stats?.[madeKey]);
				const att = toNumber(p.stats?.[attKey]);
				return `${playerLabel(p)} (${String(madeKey)}=${made}, ${String(attKey)}=${att})`;
			});

		return makeCheck(
			ruleId,
			"hard",
			offenders.length === 0,
			offenders.length === 0 ? "No impossible stat lines found" : offenders.join("; ")
		);
	};

	checks.push(impossibleRule("fg_impossible", "fg_made", "fg_att"));
	checks.push(impossibleRule("three_impossible", "three_made", "three_att"));
	checks.push(impossibleRule("ft_impossible", "ft_made", "ft_att"));

	checks.push(
		makeCheck(
			"duplicate_game",
			"hard",
			options?.duplicateGameExists !== true,
			options?.duplicateGameExists === true
				? "Duplicate committed game detected"
				: "No duplicate committed game detected"
		)
	);

	const fdOffenders = players
		.filter((p) => !p.dnp)
		.filter((p) => {
			const fd = toNumber(p.stats?.fouls_drawn);
			return fd !== null && fd > 10;
		})
		.map((p) => `${playerLabel(p)} (FD=${toNumber(p.stats?.fouls_drawn)})`);

	checks.push(
		makeCheck(
			"fd_range",
			"soft",
			fdOffenders.length === 0,
			fdOffenders.length === 0 ? "All fouls_drawn values are within range" : fdOffenders.join("; ")
		)
	);

	const dnpHasStatsOffenders = players
		.filter((p) => p.dnp === true)
		.filter((p) => {
			const stats = p.stats ?? {};
			return Object.values(stats).some((value) => value !== null && value !== undefined);
		})
		.map((p) => playerLabel(p));

	checks.push(
		makeCheck(
			"dnp_has_stats",
			"soft",
			dnpHasStatsOffenders.length === 0,
			dnpHasStatsOffenders.length === 0
				? "No DNP players with stats"
				: `DNP players with stats: ${dnpHasStatsOffenders.join(", ")}`
		)
	);

	const zeroMinuteOffenders = players
		.filter((p) => !p.dnp)
		.filter((p) => p.stats?.min === "0:00" || p.stats?.min === "00:00")
		.filter((p) => {
			const stats = p.stats ?? {};
			return Object.entries(stats)
				.filter(([key]) => key !== "min")
				.some(([, value]) => typeof value === "number" && value !== 0);
		})
		.map((p) => playerLabel(p));

	checks.push(
		makeCheck(
			"zero_minutes_has_stats",
			"soft",
			zeroMinuteOffenders.length === 0,
			zeroMinuteOffenders.length === 0
				? "No players with 0:00 and non-zero stats"
				: `Players with 0:00 and stats: ${zeroMinuteOffenders.join(", ")}`
		)
	);

	const efficiencyNullOffenders = players
		.filter((p) => !p.dnp)
		.filter((p) => p.stats?.efficiency === null || p.stats?.efficiency === undefined)
		.map((p) => playerLabel(p));

	checks.push(
		makeCheck(
			"efficiency_null",
			"soft",
			efficiencyNullOffenders.length === 0,
			efficiencyNullOffenders.length === 0
				? "Efficiency present for all non-DNP players"
				: `Missing efficiency for: ${efficiencyNullOffenders.join(", ")}`
		)
	);

	const pointsVerifyOffenders = players
		.filter((p) => !p.dnp)
		.filter((p) => {
			const two = toNumber(p.stats?.two_made);
			const three = toNumber(p.stats?.three_made);
			const ft = toNumber(p.stats?.ft_made);
			const points = toNumber(p.stats?.points);
			if (two === null || three === null || ft === null || points === null) {
				return false;
			}
			return points !== two * 2 + three * 3 + ft;
		})
		.map((p) => {
			const two = toNumber(p.stats?.two_made) ?? 0;
			const three = toNumber(p.stats?.three_made) ?? 0;
			const ft = toNumber(p.stats?.ft_made) ?? 0;
			const points = toNumber(p.stats?.points) ?? 0;
			const expected = two * 2 + three * 3 + ft;
			return `${playerLabel(p)} (points=${points}, expected=${expected})`;
		});

	checks.push(
		makeCheck(
			"points_verify",
			"soft",
			pointsVerifyOffenders.length === 0,
			pointsVerifyOffenders.length === 0
				? "Points formula matches for all comparable players"
				: pointsVerifyOffenders.join("; ")
		)
	);

	// Duplicate jersey numbers within the same team
	const jerseySeenByTeam = new Map<string, Map<number, string>>();
	const duplicateJerseyOffenders: string[] = [];
	for (const p of players) {
		const team = typeof p.team_code === "string" && p.team_code.trim() ? p.team_code.trim().toUpperCase() : null;
		const num = toNumber(p.number);
		if (team === null || num === null) continue;
		if (!jerseySeenByTeam.has(team)) jerseySeenByTeam.set(team, new Map());
		const seen = jerseySeenByTeam.get(team)!;
		if (seen.has(num)) {
			duplicateJerseyOffenders.push(`${team} #${num}: ${seen.get(num)} & ${playerLabel(p)}`);
		} else {
			seen.set(num, playerLabel(p));
		}
	}

	checks.push(
		makeCheck(
			"duplicate_jersey",
			"soft",
			duplicateJerseyOffenders.length === 0,
			duplicateJerseyOffenders.length === 0
				? "No duplicate jersey numbers within any team"
				: `Duplicate jersey numbers: ${duplicateJerseyOffenders.join("; ")}`
		)
	);

	return checks;
}

