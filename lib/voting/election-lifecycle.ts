import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateElectionSummary } from "@/lib/ai/gemini";
import type { Election, Position, PositionResultRow } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

async function generateSummaryForPosition(admin: AdminClient, electionId: string, position: Position) {
  const { data } = await admin.rpc("get_position_results", { p_position_id: position.id });
  const results = (data ?? []) as PositionResultRow[];
  const totalVotes = results.reduce((sum, r) => sum + Number(r.vote_count), 0);

  try {
    const summary = await generateElectionSummary({
      positionName: position.name,
      totalVotes,
      results,
    });

    await admin.from("ai_summaries").upsert(
      {
        election_id: electionId,
        position_id: position.id,
        summary: summary.summary,
        winner_name: summary.winner,
        winner_votes: summary.winner_votes,
        winner_percentage: summary.winner_percentage,
        is_tie: summary.is_tie,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "election_id,position_id" }
    );
  } catch {
    // Best-effort: a transient Gemini failure must never block an election
    // from closing. Admins can regenerate individual summaries afterward.
  }
}

export async function generateSummariesForElection(admin: AdminClient, electionId: string) {
  const { data: positions } = await admin
    .from("positions")
    .select("*")
    .eq("election_id", electionId)
    .eq("is_active", true);

  await Promise.all((positions ?? []).map((position) => generateSummaryForPosition(admin, electionId, position)));
}

/**
 * If `election` is still marked "open" but its voting window has passed,
 * closes it and generates AI summaries for its positions. Called on every
 * read of the current election so the transition happens automatically
 * regardless of who's viewing the page (voter, admin, or nobody watching a
 * clock) -- no cron job required. Uses the service-role client since the
 * viewer triggering this may be an anonymous voter with no write access to
 * `elections`.
 */
export async function autoCloseIfExpired(election: Election): Promise<Election> {
  if (election.status !== "open") return election;
  if (Date.now() <= new Date(election.end_at).getTime()) return election;

  const admin = createAdminClient();
  const { data } = await admin
    .from("elections")
    .update({ status: "closed" })
    .eq("id", election.id)
    .eq("status", "open") // avoid a duplicate transition if another request beat us to it
    .select()
    .single();

  if (!data) return election;

  await admin.from("audit_logs").insert({
    user_id: null,
    action: "SYSTEM_CLOSED_ELECTION",
    entity_type: "election",
    entity_id: election.id,
    metadata: { end_at: election.end_at },
  });

  await generateSummariesForElection(admin, election.id);

  return data;
}
