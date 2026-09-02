"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateElectionSummary, AiSummaryError } from "@/lib/ai/gemini";
import { getPositionResult } from "@/lib/voting/queries";
import { generateSummariesForElection } from "@/lib/voting/election-lifecycle";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Position } from "@/types/database";
import {
  candidateSchema,
  classMemberSchema,
  csvClassMemberRowSchema,
  electionSchema,
  positionSchema,
} from "@/lib/validation/schemas";
import { parseCsv, csvRowsToObjects } from "@/lib/csv";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function revalidateElectionSurfaces() {
  revalidatePath("/", "layout");
}

async function audit(action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("audit_logs").insert({
    user_id: user?.id ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ?? null,
  });
}

// ---------------------------------------------------------------------------
// Elections
// ---------------------------------------------------------------------------

export async function createElection(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("elections")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      start_at: new Date(parsed.data.start_at).toISOString(),
      end_at: new Date(parsed.data.end_at).toISOString(),
      status: parsed.data.status,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "Could not create the election." };

  await audit("ADMIN_CREATED_ELECTION", "election", data.id, { name: parsed.data.name });
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function updateElection(id: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("elections").select("status").eq("id", id).single();

  const { error } = await supabase
    .from("elections")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      start_at: new Date(parsed.data.start_at).toISOString(),
      end_at: new Date(parsed.data.end_at).toISOString(),
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "Could not update the election." };

  const becameClosed = existing?.status !== "closed" && parsed.data.status === "closed";
  await audit(
    becameClosed ? "ADMIN_CLOSED_ELECTION" : "ADMIN_UPDATED_ELECTION",
    "election",
    id,
    { status: parsed.data.status }
  );

  if (becameClosed) {
    // Best-effort: closing the election must succeed even if AI summary
    // generation fails for some position (e.g. a transient Gemini error).
    // Admins can always regenerate individual summaries from Admin -> Results.
    await generateSummariesForElection(createAdminClient(), id);
    revalidatePath("/results");
    revalidatePath("/admin/results");
  }

  revalidateElectionSurfaces();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export async function createPosition(electionId: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("positions")
    .insert({
      election_id: electionId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      display_order: parsed.data.display_order,
      is_active: parsed.data.is_active,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "A position with that name already exists." };
    return { ok: false, error: "Could not create the position." };
  }

  await audit("ADMIN_CREATED_POSITION", "position", data.id, { name: parsed.data.name });
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function updatePosition(id: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = positionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("positions")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      display_order: parsed.data.display_order,
      is_active: parsed.data.is_active,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "Could not update the position." };

  await audit("ADMIN_UPDATED_POSITION", "position", id);
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function togglePositionActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("positions").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: "Could not update the position." };
  await audit("ADMIN_UPDATED_POSITION", "position", id, { is_active: isActive });
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function movePosition(
  electionId: string,
  id: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: positions } = await supabase
    .from("positions")
    .select("id, display_order")
    .eq("election_id", electionId)
    .order("display_order", { ascending: true });

  if (!positions) return { ok: false, error: "Positions not found." };

  const index = positions.findIndex((p) => p.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= positions.length) return { ok: true };

  const a = positions[index];
  const b = positions[swapIndex];

  await Promise.all([
    supabase.from("positions").update({ display_order: b.display_order }).eq("id", a.id),
    supabase.from("positions").update({ display_order: a.display_order }).eq("id", b.id),
  ]);

  revalidateElectionSurfaces();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Class members
// ---------------------------------------------------------------------------

export async function createClassMember(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = classMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_members")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "This class member already exists." };
    return { ok: false, error: "Could not add the class member." };
  }

  await audit("ADMIN_CREATED_CLASS_MEMBER", "class_member", data.id, { full_name: parsed.data.full_name });
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function updateClassMember(id: string, input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = classMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.from("class_members").update(parsed.data).eq("id", id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Another class member already has that name." };
    return { ok: false, error: "Could not update the class member." };
  }

  await audit("ADMIN_UPDATED_CLASS_MEMBER", "class_member", id);
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function toggleClassMemberActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("class_members").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: "Could not update the class member." };
  await audit("ADMIN_UPDATED_CLASS_MEMBER", "class_member", id, { is_active: isActive });
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function deleteClassMember(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("class_members").delete().eq("id", id);

  if (error) {
    return {
      ok: false,
      error: "This class member is nominated for a position and cannot be deleted. Remove their nomination(s) first, or disable them instead.",
    };
  }

  await audit("ADMIN_DELETED_CLASS_MEMBER", "class_member", id);
  revalidateElectionSurfaces();
  return { ok: true };
}

export interface CsvImportResult extends ActionResult {
  inserted?: number;
  skipped?: number;
  errors?: string[];
}

export async function importClassMembersCsv(csvText: string): Promise<CsvImportResult> {
  await requireAdmin();

  let objects: Record<string, string>[];
  try {
    objects = csvRowsToObjects(parseCsv(csvText));
  } catch {
    return { ok: false, error: "Could not parse the CSV file." };
  }

  if (objects.length === 0) {
    return { ok: false, error: "The CSV file has no data rows." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from("class_members").select("full_name, graduation_year");
  const existingKeys = new Set(
    (existing ?? []).map((m) => `${m.full_name.trim().toLowerCase()}::${m.graduation_year}`)
  );

  const errors: string[] = [];
  const seenInFile = new Set<string>();
  const toInsert: { full_name: string; department: string; graduation_year: number }[] = [];
  let skipped = 0;

  objects.forEach((row, index) => {
    const parsed = csvClassMemberRowSchema.safeParse(row);
    if (!parsed.success) {
      errors.push(`Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "invalid row"}`);
      return;
    }
    const key = `${parsed.data.full_name.trim().toLowerCase()}::${parsed.data.graduation_year}`;
    if (existingKeys.has(key) || seenInFile.has(key)) {
      skipped++;
      return;
    }
    seenInFile.add(key);
    toInsert.push(parsed.data);
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from("class_members").insert(toInsert);
    if (error) return { ok: false, error: "Could not import class members." };
  }

  await audit("ADMIN_IMPORTED_CLASS_MEMBERS", "class_member", undefined, {
    inserted: toInsert.length,
    skipped,
  });
  revalidateElectionSurfaces();

  return { ok: true, inserted: toInsert.length, skipped, errors };
}

// ---------------------------------------------------------------------------
// Candidates (per-position nominations)
// ---------------------------------------------------------------------------

export async function nominateCandidate(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = candidateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This class member is already nominated for this position." };
    }
    return { ok: false, error: "Could not add the nomination." };
  }

  await audit("ADMIN_NOMINATED_CANDIDATE", "candidate", data.id, parsed.data);
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function toggleCandidateActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: "Could not update the nomination." };
  await audit("ADMIN_UPDATED_CANDIDATE", "candidate", id, { is_active: isActive });
  revalidateElectionSurfaces();
  return { ok: true };
}

export async function removeCandidate(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").delete().eq("id", id);

  if (error) {
    return {
      ok: false,
      error: "This nominee has already received votes and cannot be removed. Disable them instead.",
    };
  }

  await audit("ADMIN_REMOVED_CANDIDATE", "candidate", id);
  revalidateElectionSurfaces();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Vote reset (lets members revote on a position after a mistake)
// ---------------------------------------------------------------------------

/**
 * Deletes every vote cast for a position so members can revote from scratch.
 * Votes are otherwise immutable (see supabase/migrations/0001_init.sql,
 * 0003_admin_vote_reset.sql) -- this is the one sanctioned, audited way to
 * delete any, and it always resets the whole position, never a single vote,
 * since voting is anonymous and there is no reliable way to pick out one
 * member's ballot.
 */
export async function resetPositionVotes(positionId: string): Promise<ActionResult> {
  await requireAdmin();

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("position_id", positionId);
  if (countError) return { ok: false, error: "Could not read the current votes." };

  const { error: deleteVotesError } = await admin.from("votes").delete().eq("position_id", positionId);
  if (deleteVotesError) return { ok: false, error: "Could not reset the votes for this position." };

  // The cached AI summary would otherwise keep describing the old tally.
  await admin.from("ai_summaries").delete().eq("position_id", positionId);

  await audit("ADMIN_RESET_POSITION_VOTES", "position", positionId, { votes_deleted: count ?? 0 });
  revalidateElectionSurfaces();
  revalidatePath("/results");
  revalidatePath("/admin/results");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AI summaries
// ---------------------------------------------------------------------------

async function generateSummaryForPosition(
  supabase: SupabaseClient<Database>,
  electionId: string,
  position: Position
): Promise<ActionResult> {
  const result = await getPositionResult(supabase, position);

  try {
    const summary = await generateElectionSummary({
      positionName: position.name,
      totalVotes: result.totalVotes,
      results: result.results,
    });

    const { error } = await supabase.from("ai_summaries").upsert(
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

    if (error) return { ok: false, error: "Could not save the AI summary." };

    await audit("AI_SUMMARY_GENERATED", "position", position.id);
    return { ok: true };
  } catch (err) {
    if (err instanceof AiSummaryError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "The AI summary could not be generated right now." };
  }
}

export async function generateAiSummary(electionId: string, positionId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: position } = await supabase.from("positions").select("*").eq("id", positionId).single();
  if (!position) return { ok: false, error: "Position not found." };

  const result = await generateSummaryForPosition(supabase, electionId, position);
  revalidatePath("/results");
  revalidatePath("/admin/results");
  return result;
}
