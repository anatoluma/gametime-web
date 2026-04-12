import { createClient } from "@supabase/supabase-js";
import { EXTRACTION_PROMPT } from "@/lib/extraction-prompt";

const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = process.env.BOX_SCORES_STORAGE_BUCKET ?? "uploads";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

type ProcessingJobRow = {
	id: string;
	raw_file_path: string;
};

type AnthropicTextContent = {
	type: "text";
	text: string;
};

type AnthropicResponse = {
	content?: AnthropicTextContent[];
	error?: {
		message?: string;
	};
};

function inferMediaType(path: string): string {
	const lower = path.toLowerCase();
	if (lower.endsWith(".png")) {
		return "image/png";
	}
	if (lower.endsWith(".webp")) {
		return "image/webp";
	}
	return "image/jpeg";
}

async function setJobError(jobId: string, errorMessage: string): Promise<void> {
	await supabaseAdmin
		.from("processing_jobs")
		.update({
			error_message: errorMessage,
			updated_at: new Date().toISOString(),
		})
		.eq("id", jobId);
}

export async function extractBoxScore(jobId: string): Promise<Record<string, unknown>> {
	try {
		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new Error("ANTHROPIC_API_KEY is not configured");
		}

		const { data: job, error: jobError } = await supabaseAdmin
			.from("processing_jobs")
			.select("id, raw_file_path")
			.eq("id", jobId)
			.single<ProcessingJobRow>();

		if (jobError || !job) {
			throw new Error(jobError?.message ?? `Processing job ${jobId} not found`);
		}

		const { error: extractingStatusError } = await supabaseAdmin
			.from("processing_jobs")
			.update({
				status: "extracting",
				error_message: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		if (extractingStatusError) {
			throw new Error(`Failed to set extracting status: ${extractingStatusError.message}`);
		}

		const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
			.from(STORAGE_BUCKET)
			.download(job.raw_file_path);

		if (downloadError || !fileBlob) {
			throw new Error(`Failed to read raw file: ${downloadError?.message ?? "unknown error"}`);
		}

		const imageArrayBuffer = await fileBlob.arrayBuffer();
		const base64Image = Buffer.from(imageArrayBuffer).toString("base64");
		const mediaType = inferMediaType(job.raw_file_path);

		const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
			body: JSON.stringify({
				model: ANTHROPIC_MODEL,
				max_tokens: 32000,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "image",
								source: {
									type: "base64",
									media_type: mediaType,
									data: base64Image,
								},
							},
							{
								type: "text",
								text: EXTRACTION_PROMPT,
							},
						],
					},
				],
			}),
		});

		const body = (await anthropicResponse.json()) as AnthropicResponse;

		if (!anthropicResponse.ok) {
			throw new Error(body.error?.message ?? "Claude API request failed");
		}

		const outputText = body.content?.find((item) => item.type === "text")?.text;
		if (!outputText) {
			throw new Error("Claude response did not include text content");
		}

		let extractionJson: Record<string, unknown>;
		try {
		const cleaned = outputText.replace(/```json|```/g, "").trim();
		extractionJson = JSON.parse(cleaned) as Record<string, unknown>;
		} catch {
		const truncated = outputText.length > 0 && !outputText.trimEnd().endsWith("}");
		const hint = truncated ? " (response appears truncated — likely hit token limit)" : "";
		throw new Error(`Claude response was not valid JSON${hint}: ${outputText.slice(0, 300)}`);
		}

		const { error: updateError } = await supabaseAdmin
			.from("processing_jobs")
			.update({
				extraction_json: extractionJson,
				error_message: null,
				updated_at: new Date().toISOString(),
			})
			.eq("id", jobId);

		if (updateError) {
			throw new Error(`Failed to persist extraction result: ${updateError.message}`);
		}

		return extractionJson;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown extraction error";
		await setJobError(jobId, message);
		throw error;
	}
}
