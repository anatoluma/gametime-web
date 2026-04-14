import { createClient } from "@supabase/supabase-js";
import { extractBoxScore } from "@/lib/claude";
import { validateExtraction } from "@/lib/validation";
import { resolvePlayerNames } from "@/lib/name-resolution";
import { normalizeExtractionJson } from "@/lib/normalize-extraction";
import { resolveTeamCodes } from "@/lib/resolve-teams";

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AUTO_ACCEPT_THRESHOLD = 0.92;

export async function runPipeline(jobId: string): Promise<void> {
	try {
		// Step 1: Extract — sets status to "extracting", returns extraction_json
		let extractionJson = await extractBoxScore(jobId);

		// Step 1b: Normalize field names/structure before validation
		// Different FIBA software uses different abbreviations; Claude sometimes mirrors them.
		extractionJson = normalizeExtractionJson(extractionJson);

		// Step 1c: Resolve extracted team codes → canonical DB team IDs
		// Fuzzy-matches against all teams so "MED" → "USM" etc. are corrected automatically.
		const homeCode = (extractionJson.home_team as Record<string, unknown> | null)?.code as string | null;
		const awayCode = (extractionJson.away_team as Record<string, unknown> | null)?.code as string | null;
		const codesToResolve = [homeCode, awayCode].filter((c): c is string => !!c);
		if (codesToResolve.length > 0) {
			const teamResolutions = await resolveTeamCodes(codesToResolve);
			const resolvedHome = teamResolutions.find((r) => r.extracted_code === homeCode);
			const resolvedAway = teamResolutions.find((r) => r.extracted_code === awayCode);
			const newHomeCode = resolvedHome?.resolved_id ?? homeCode;
			const newAwayCode = resolvedAway?.resolved_id ?? awayCode;

			if (newHomeCode !== homeCode || newAwayCode !== awayCode) {
				// Patch home_team, away_team, and every player/team_total row
				extractionJson = {
					...extractionJson,
					home_team: { ...(extractionJson.home_team as object), code: newHomeCode },
					away_team: { ...(extractionJson.away_team as object), code: newAwayCode },
					players: Array.isArray(extractionJson.players)
						? (extractionJson.players as Record<string, unknown>[]).map((p) => ({
								...p,
								team_code:
									p.team_code === homeCode ? newHomeCode
									: p.team_code === awayCode ? newAwayCode
									: p.team_code,
						  }))
						: extractionJson.players,
					team_totals: Array.isArray(extractionJson.team_totals)
						? (extractionJson.team_totals as Record<string, unknown>[]).map((t) => ({
								...t,
								team_code:
									t.team_code === homeCode ? newHomeCode
									: t.team_code === awayCode ? newAwayCode
									: t.team_code,
						  }))
						: extractionJson.team_totals,
				};
			}
		}

		await supabaseAdmin
			.from("processing_jobs")
			.update({ extraction_json: extractionJson, updated_at: new Date().toISOString() })
			.eq("id", jobId);

		// Step 2: Validate — evaluate all hard and soft rules
		const validationChecks = validateExtraction(extractionJson);
		const hasHardFailure = validationChecks.some((c) => c.severity === "hard" && !c.passed);

		await supabaseAdmin
			.from("processing_jobs")
			.update({
				validation_json: validationChecks,
				status: hasHardFailure ? "needs_review" : "resolving",
				updated_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		// Hard failure blocks everything downstream — stop here
		if (hasHardFailure) return;

		// Step 3: Resolve player names — fuzzy match + alias lookup
		const resolutionResults = await resolvePlayerNames(jobId);

		// Step 4: Determine final status
		// Approved only when every validation check passed AND every resolution is high-confidence
		const allValidationPassed = validationChecks.every((c) => c.passed);
		const allHighConfidence = resolutionResults.every(
			(r) => (r.confidence ?? 0) >= AUTO_ACCEPT_THRESHOLD
		);
		const finalStatus = allValidationPassed && allHighConfidence ? "approved" : "needs_review";

		await supabaseAdmin
			.from("processing_jobs")
			.update({
				status: finalStatus,
				updated_at: new Date().toISOString(),
			})
			.eq("id", jobId);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown pipeline error";
		await supabaseAdmin
			.from("processing_jobs")
			.update({
				error_message: message,
				status: "failed",
				updated_at: new Date().toISOString(),
			})
			.eq("id", jobId);
	}
}
