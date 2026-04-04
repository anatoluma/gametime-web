import { createClient } from "@supabase/supabase-js";
import { extractBoxScore } from "@/lib/claude";
import { validateExtraction } from "@/lib/validation";
import { resolvePlayerNames } from "@/lib/name-resolution";

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AUTO_ACCEPT_THRESHOLD = 0.92;

export async function runPipeline(jobId: string): Promise<void> {
	try {
		// Step 1: Extract — sets status to "extracting", returns extraction_json
		const extractionJson = await extractBoxScore(jobId);

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
