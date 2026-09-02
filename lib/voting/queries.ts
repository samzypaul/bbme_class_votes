import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CandidateOption, Election, Position, PositionResultRow } from "@/types/database";
import { autoCloseIfExpired } from "@/lib/voting/election-lifecycle";

type Client = SupabaseClient<Database>;

/**
 * Picks the single election to display to members: an open one takes
 * priority, then an upcoming draft, then the most recently closed one.
 */
export async function getCurrentElection(supabase: Client): Promise<Election | null> {
  const { data } = await supabase
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return null;

  const election =
    data.find((e) => e.status === "open") ??
    data.find((e) => e.status === "draft") ??
    data[0];

  return autoCloseIfExpired(election);
}

export async function getActivePositions(
  supabase: Client,
  electionId: string
): Promise<Position[]> {
  const { data } = await supabase
    .from("positions")
    .select("*")
    .eq("election_id", electionId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  return data ?? [];
}

/** Map of position_id -> its active nominees, for scoping the ballot's
 * candidate picker to only whoever was actually nominated for that position. */
export async function getCandidatesByPositions(
  supabase: Client,
  positionIds: string[]
): Promise<Record<string, CandidateOption[]>> {
  if (positionIds.length === 0) return {};

  const { data: candidateRows } = await supabase
    .from("candidates")
    .select("*")
    .in("position_id", positionIds)
    .eq("is_active", true);

  const rows = candidateRows ?? [];
  if (rows.length === 0) return {};

  const memberIds = [...new Set(rows.map((r) => r.class_member_id))];
  const { data: members } = await supabase
    .from("class_members")
    .select("id, full_name")
    .in("id", memberIds);

  const nameById = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const map: Record<string, CandidateOption[]> = {};
  for (const row of rows) {
    const option: CandidateOption = {
      id: row.id,
      full_name: nameById.get(row.class_member_id) ?? "Unknown",
    };
    (map[row.position_id] ??= []).push(option);
  }
  for (const list of Object.values(map)) {
    list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }
  return map;
}

/** Map of position_id -> candidate_id for the signed-in member's own votes. */
export async function getUserVoteMap(
  supabase: Client,
  voterId: string,
  electionId: string
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("votes")
    .select("position_id, candidate_id")
    .eq("voter_id", voterId)
    .eq("election_id", electionId);

  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.position_id] = row.candidate_id;
  return map;
}

export interface PositionResult {
  position: Position;
  totalVotes: number;
  results: PositionResultRow[];
  top5: PositionResultRow[];
  winners: PositionResultRow[]; // more than one entry means a tie
  isTie: boolean;
}

export async function getPositionResult(
  supabase: Client,
  position: Position
): Promise<PositionResult> {
  const { data } = await supabase.rpc("get_position_results", {
    p_position_id: position.id,
  });

  const results = (data ?? []) as PositionResultRow[];
  const totalVotes = results.reduce((sum, r) => sum + Number(r.vote_count), 0);
  const top5 = results.slice(0, 5);
  const highest = results[0]?.vote_count ?? 0;
  const winners = highest > 0 ? results.filter((r) => Number(r.vote_count) === Number(highest)) : [];

  return {
    position,
    totalVotes,
    results,
    top5,
    winners,
    isTie: winners.length > 1,
  };
}

export async function getAllPositionResults(
  supabase: Client,
  positions: Position[]
): Promise<PositionResult[]> {
  return Promise.all(positions.map((p) => getPositionResult(supabase, p)));
}
