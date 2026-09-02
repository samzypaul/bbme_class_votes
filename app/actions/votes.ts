"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/helpers";
import { castVotesSchema } from "@/lib/validation/schemas";
import { getActivePositions, getCandidatesByPositions, getUserVoteMap } from "@/lib/voting/queries";

export interface CastVotesResult {
  ok: boolean;
  error?: string;
}

/**
 * The single, authoritative entry point for casting votes. Every rule from
 * the spec is re-checked here, server-side, against fresh data -- the client
 * only supplies position_id/candidate_id pairs, never trusted counts or
 * state. The database (UNIQUE constraint + BEFORE INSERT trigger, see
 * supabase/migrations/0001_init.sql) is the final backstop even if this
 * function were somehow bypassed.
 */
export async function castVotes(input: unknown): Promise<CastVotesResult> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {
      ok: false,
      error: "We couldn't verify your voting session. Please refresh the page and try again.",
    };
  }

  const parsed = castVotesSchema.safeParse(input);
  if (!parsed.success) {
    console.error("castVotes: schema validation failed", JSON.stringify(input), parsed.error.flatten());
    return { ok: false, error: "Invalid ballot submission." };
  }
  const { election_id, selections } = parsed.data;

  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("*")
    .eq("id", election_id)
    .single();

  if (!election) return { ok: false, error: "Election not found." };

  if (election.status !== "open") {
    return { ok: false, error: "Voting is now closed. Your vote could not be submitted." };
  }

  const now = Date.now();
  if (now < new Date(election.start_at).getTime()) {
    return { ok: false, error: "Voting hasn't started yet. Your vote could not be submitted." };
  }
  if (now > new Date(election.end_at).getTime()) {
    return { ok: false, error: "Voting is now closed. Your vote could not be submitted." };
  }

  const [positions, existingVotes] = await Promise.all([
    getActivePositions(supabase, election_id),
    getUserVoteMap(supabase, profile.id, election_id),
  ]);

  const positionIds = new Set(positions.map((p) => p.id));
  const candidatesByPosition = await getCandidatesByPositions(supabase, [...positionIds]);

  for (const selection of selections) {
    if (!positionIds.has(selection.position_id)) {
      return { ok: false, error: "One of the selected positions is not open for voting." };
    }
    const nominees = candidatesByPosition[selection.position_id] ?? [];
    if (!nominees.some((c) => c.id === selection.candidate_id)) {
      return { ok: false, error: "Please select a valid nominee for this position." };
    }
    if (existingVotes[selection.position_id]) {
      return { ok: false, error: "You have already voted for this position." };
    }
  }

  const uniquePositions = new Set(selections.map((s) => s.position_id));
  if (uniquePositions.size !== selections.length) {
    return { ok: false, error: "You can only select one candidate per position." };
  }

  const rows = selections.map((s) => ({
    election_id,
    position_id: s.position_id,
    voter_id: profile.id,
    candidate_id: s.candidate_id,
  }));

  const { error } = await supabase.from("votes").insert(rows);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You have already voted for one of these positions." };
    }
    return { ok: false, error: "Your vote could not be recorded. Please try again." };
  }

  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      user_id: profile.id,
      action: "USER_CAST_VOTE",
      entity_type: "election",
      entity_id: election_id,
      metadata: { position_count: selections.length },
    });
  } catch {
    // Audit logging must never block a successfully recorded vote.
  }

  revalidatePath("/vote");

  return { ok: true };
}
