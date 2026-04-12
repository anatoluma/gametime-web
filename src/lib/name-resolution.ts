import { createClient } from "@supabase/supabase-js";
import { resolveTeamId } from "@/lib/team-codes";

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AUTO_ACCEPT_THRESHOLD = 0.92;
const REVIEW_THRESHOLD = 0.7;
const NUMBER_HINT_BOOST = 0.15;

type ProcessingJob = {
	id: string;
	extraction_json: {
		players?: ExtractedPlayer[] | null;
	} | null;
};

type TeamRow = {
	team_id: string;
};

type PlayerRow = {
	player_id: string;
	team_id: string;
	first_name: string | null;
	last_name: string | null;
	jersey_number: number | null;
};

type ExtractedPlayer = {
	team_code?: string | null;
	number?: number | null;
	name?: string | null;
};

type AliasRow = {
	alias_name: string;
	player_id: string;
	confidence: number | null;
	resolution_method: string | null;
	confirmed_by: string | null;
	players:
		| {
				player_id: string;
				first_name: string | null;
				last_name: string | null;
			}
		| {
				player_id: string;
				first_name: string | null;
				last_name: string | null;
			}[]
		| null;
};

export type ResolutionMethod =
	| "exact"
	| "fuzzy"
	| "number_hint"
	| "manual"
	| "unresolved";

export type NameResolutionCandidate = {
	player_id: string;
	name: string;
	confidence: number;
	jersey_number: number | null;
};

export type NameResolutionResult = {
	team_code: string | null;
	number: number | null;
	extracted_name: string;
	resolved_player_id: string | null;
	resolved_name: string | null;
	confidence: number;
	method: ResolutionMethod;
	confirmed: boolean;
	candidates?: NameResolutionCandidate[];
	note?: string;
};

function toStringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeName(value: string | null): string {
	if (!value) {
		return "";
	}
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[.\s'’-]+/g, "")
		.replace(/[^a-zA-Z0-9]/g, "")
		.toLowerCase();
}

function canonicalPlayerName(player: PlayerRow): string {
	return `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
}

function candidateStrings(player: PlayerRow): string[] {
	const first = normalizeName(player.first_name);
	const last = normalizeName(player.last_name);
	const full = normalizeName(canonicalPlayerName(player));
	const firstInitialLast = first.length > 0 ? `${first[0]}${last}` : "";
	const firstLast = `${first}${last}`;

	return [full, firstLast, firstInitialLast, last].filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
}

function jaroSimilarity(left: string, right: string): number {
	if (left === right) {
		return 1;
	}
	if (left.length === 0 || right.length === 0) {
		return 0;
	}

	const matchDistance = Math.max(Math.floor(Math.max(left.length, right.length) / 2) - 1, 0);
	const leftMatches = new Array<boolean>(left.length).fill(false);
	const rightMatches = new Array<boolean>(right.length).fill(false);

	let matches = 0;
	for (let i = 0; i < left.length; i += 1) {
		const start = Math.max(0, i - matchDistance);
		const end = Math.min(i + matchDistance + 1, right.length);

		for (let j = start; j < end; j += 1) {
			if (rightMatches[j] || left[i] !== right[j]) {
				continue;
			}
			leftMatches[i] = true;
			rightMatches[j] = true;
			matches += 1;
			break;
		}
	}

	if (matches === 0) {
		return 0;
	}

	let transpositions = 0;
	let rightIndex = 0;

	for (let i = 0; i < left.length; i += 1) {
		if (!leftMatches[i]) {
			continue;
		}
		while (!rightMatches[rightIndex]) {
			rightIndex += 1;
		}
		if (left[i] !== right[rightIndex]) {
			transpositions += 1;
		}
		rightIndex += 1;
	}

	return (
		(matches / left.length + matches / right.length + (matches - transpositions / 2) / matches) /
		3
	);
}

function jaroWinkler(left: string, right: string): number {
	const jaro = jaroSimilarity(left, right);
	const prefixLimit = 4;
	let prefix = 0;

	for (let i = 0; i < Math.min(prefixLimit, left.length, right.length); i += 1) {
		if (left[i] !== right[i]) {
			break;
		}
		prefix += 1;
	}

	return jaro + prefix * 0.1 * (1 - jaro);
}

function bestScoreForPlayer(extractedName: string, player: PlayerRow): number {
	const normalized = normalizeName(extractedName);
	return candidateStrings(player).reduce((best, candidate) => Math.max(best, jaroWinkler(normalized, candidate)), 0);
}

function normalizeTeamCode(teamCode: string | null): string | null {
	return teamCode ? teamCode.trim().toUpperCase() : null;
}

async function setResolutionError(jobId: string, message: string): Promise<void> {
	await supabaseAdmin
		.from("processing_jobs")
		.update({
			error_message: message,
			updated_at: new Date().toISOString(),
		})
		.eq("id", jobId);
}

function normalizeAliasPlayer(aliasPlayer: AliasRow["players"]): AliasRow["players"] extends infer _ ? { player_id: string; first_name: string | null; last_name: string | null } | null : never {
	if (Array.isArray(aliasPlayer)) {
		return aliasPlayer[0] ?? null;
	}
	return aliasPlayer ?? null;
}

export async function resolvePlayerNames(jobId: string): Promise<NameResolutionResult[]> {
	try {
		const { data: job, error: jobError } = await supabaseAdmin
			.from("processing_jobs")
			.select("id, extraction_json")
			.eq("id", jobId)
			.single<ProcessingJob>();

		if (jobError || !job) {
			throw new Error(jobError?.message ?? `Processing job ${jobId} not found`);
		}

		const extractedPlayers = Array.isArray(job.extraction_json?.players)
			? job.extraction_json.players.filter((player): player is ExtractedPlayer => Boolean(toStringOrNull(player?.name)))
			: [];

		const { data: teamsData, error: teamsError } = await supabaseAdmin
			.from("teams")
			.select("team_id");

		if (teamsError) {
			throw new Error(`Failed to load teams: ${teamsError.message}`);
		}

		const validTeamIds = new Set(((teamsData ?? []) as TeamRow[]).map((team) => team.team_id.toUpperCase()));

		const { data: playersData, error: playersError } = await supabaseAdmin
			.from("players")
			.select("player_id, team_id, first_name, last_name, jersey_number");

		if (playersError) {
			throw new Error(`Failed to load players: ${playersError.message}`);
		}

		const players = (playersData ?? []) as PlayerRow[];
		const rosterByTeam = new Map<string, PlayerRow[]>();
		for (const player of players) {
			const teamId = player.team_id.toUpperCase();
			const current = rosterByTeam.get(teamId) ?? [];
			current.push(player);
			rosterByTeam.set(teamId, current);
		}

		const results: NameResolutionResult[] = [];

		for (const extractedPlayer of extractedPlayers) {
			const extractedName = toStringOrNull(extractedPlayer.name)!;
			const teamCode = normalizeTeamCode(toStringOrNull(extractedPlayer.team_code));
			const jerseyNumber = toNumber(extractedPlayer.number);

			const { data: aliasData, error: aliasError } = await supabaseAdmin
				.from("player_aliases")
				.select("alias_name, player_id, confidence, resolution_method, confirmed_by, players(player_id, first_name, last_name)")
				.eq("alias_name", extractedName)
				.not("confirmed_by", "is", null)
				.limit(1);

			if (aliasError) {
				throw new Error(`Failed to check player aliases: ${aliasError.message}`);
			}

			const exactAlias = ((aliasData ?? []) as AliasRow[])[0];
			if (exactAlias) {
				const aliasPlayer = normalizeAliasPlayer(exactAlias.players);
				results.push({
					team_code: teamCode,
					number: jerseyNumber,
					extracted_name: extractedName,
					resolved_player_id: exactAlias.player_id,
					resolved_name: aliasPlayer ? canonicalPlayerName(aliasPlayer as PlayerRow) : null,
					confidence: 1,
					method: "exact",
					confirmed: true,
				});
				continue;
			}

			const resolvedTeamId = resolveTeamId(teamCode);
			const roster = resolvedTeamId ? rosterByTeam.get(resolvedTeamId) ?? [] : [];
			const scoredCandidates = roster
				.map((player) => {
					const baseScore = bestScoreForPlayer(extractedName, player);
					const numberMatch = jerseyNumber !== null && player.jersey_number === jerseyNumber;
					const boostedScore = numberMatch
						? Math.min(1, baseScore + NUMBER_HINT_BOOST)
						: baseScore;

					return { player, baseScore, boostedScore, numberMatch };
				})
				// Sort by boostedScore so jersey-matched players rise to the top
				.sort((left, right) => right.boostedScore - left.boostedScore);

			// All roster players sorted by boostedScore — reviewer needs the full list to correct OCR errors
			const topCandidates = scoredCandidates.map((c) => ({
				player_id: c.player.player_id,
				name: canonicalPlayerName(c.player),
				confidence: Number(c.boostedScore.toFixed(3)),
				jersey_number: c.player.jersey_number,
			}));

			const bestCandidate = scoredCandidates[0];

			// Auto-accept: name score alone is high enough (jersey boost is secondary evidence)
			if (bestCandidate && bestCandidate.baseScore >= AUTO_ACCEPT_THRESHOLD) {
				const result: NameResolutionResult = {
					team_code: teamCode,
					number: jerseyNumber,
					extracted_name: extractedName,
					resolved_player_id: bestCandidate.player.player_id,
					resolved_name: canonicalPlayerName(bestCandidate.player),
					confidence: Number(bestCandidate.baseScore.toFixed(3)),
					method: "fuzzy",
					confirmed: false,
				};

				const { error: aliasInsertError } = await supabaseAdmin
					.from("player_aliases")
					.upsert(
						{
							alias_name: extractedName,
							player_id: bestCandidate.player.player_id,
							confidence: result.confidence,
							resolution_method: "fuzzy",
							confirmed_by: null,
							source_job_id: job.id,
						},
						{ onConflict: "alias_name,player_id" }
					);

				if (aliasInsertError) {
					throw new Error(`Failed to save fuzzy alias: ${aliasInsertError.message}`);
				}

				results.push(result);
				continue;
			}

			// Review required: decent name match OR jersey number boosted it into review range
			if (bestCandidate && bestCandidate.boostedScore >= REVIEW_THRESHOLD) {
				results.push({
					team_code: teamCode,
					number: jerseyNumber,
					extracted_name: extractedName,
					resolved_player_id: bestCandidate.player.player_id,
					resolved_name: canonicalPlayerName(bestCandidate.player),
					confidence: Number(bestCandidate.boostedScore.toFixed(3)),
					method: bestCandidate.numberMatch ? "number_hint" : "manual",
					confirmed: false,
					candidates: topCandidates,
					note: bestCandidate.numberMatch
						? "Review required: jersey number hint boosted match"
						: "Review required: fuzzy match below auto-accept threshold",
				});
				continue;
			}

			// Unresolved — still include jersey-matched players in candidates so reviewer can pick
			results.push({
				team_code: teamCode,
				number: jerseyNumber,
				extracted_name: extractedName,
				resolved_player_id: null,
				resolved_name: null,
				confidence: 0,
				method: "unresolved",
				confirmed: false,
				candidates: topCandidates,
				note: teamCode
					? "New player candidate or insufficient confidence"
					: "Team code missing or could not be mapped",
			});
		}

		const { error: updateError } = await supabaseAdmin
			.from("processing_jobs")
			.update({
				resolution_json: results,
				error_message: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", job.id);

		if (updateError) {
			throw new Error(`Failed to save resolution_json: ${updateError.message}`);
		}

		return results;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown name resolution error";
		await setResolutionError(jobId, message);
		throw error;
	}
}

