import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiSummaryResponseSchema, type AiSummaryResponse } from "@/lib/validation/schemas";
import type { PositionResultRow } from "@/types/database";

// gemini-2.0-flash has zero free-tier quota on this project's API key;
// gemini-2.5-flash is the confirmed working model. Override via env if needed.
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an election results analyst.

Analyze the following official election statistics.

Your job is to produce a concise, neutral summary.

Rules:
1. Do not change vote counts.
2. Do not invent information.
3. Do not make claims about candidates' personalities.
4. Do not make claims that are not supported by the data.
5. Identify the candidate with the highest vote count.
6. Mention the margin where useful.
7. Mention percentages where provided.
8. If there is a tie, clearly state that there is a tie and set is_tie to true.
9. Keep the tone professional and celebratory.
10. Do not make political recommendations.

Respond with ONLY minified JSON matching exactly this shape, no markdown fences, no commentary:
{"summary": string, "winner": string|null, "winner_votes": number|null, "winner_percentage": number|null, "margin": number|null, "is_tie": boolean}`;

export interface GenerateSummaryInput {
  positionName: string;
  totalVotes: number;
  results: PositionResultRow[]; // already sorted desc by vote_count
}

export class AiSummaryError extends Error {}

/**
 * Calls Gemini to produce a human-readable summary of already-computed,
 * deterministic vote tallies. Gemini never determines the winner -- the
 * caller passes in results computed by get_position_results() in Postgres,
 * and this function is only allowed to describe them.
 */
export async function generateElectionSummary(
  input: GenerateSummaryInput
): Promise<AiSummaryResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiSummaryError("GEMINI_API_KEY is not configured.");
  }

  const totalVotes = input.totalVotes;
  const top5 = input.results.slice(0, 5).map((r) => ({
    candidate: r.candidate_name,
    votes: r.vote_count,
    percentage:
      totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 1000) / 10 : 0,
  }));

  const highest = top5[0]?.votes ?? 0;
  const tiedLeaders = top5.filter((r) => r.votes === highest && highest > 0);

  const prompt = `${SYSTEM_PROMPT}

Position:
${input.positionName}

Total Votes:
${totalVotes}

Results:
${JSON.stringify(top5, null, 2)}

Detected tie among leaders: ${tiedLeaders.length > 1 ? "yes" : "no"}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: "application/json" },
  });

  let text: string;
  try {
    const result = await model.generateContent(prompt);
    text = result.response.text();
  } catch (err) {
    throw new AiSummaryError(
      err instanceof Error ? `Gemini request failed: ${err.message}` : "Gemini request failed."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiSummaryError("Gemini returned a non-JSON response.");
  }

  const validated = aiSummaryResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AiSummaryError("Gemini response failed validation.");
  }

  return validated.data;
}
