import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Server-only (the `server-only` import throws a build error if this is ever
 * pulled into a client bundle). Use exclusively for operations that must
 * cross RLS boundaries in a deliberate, audited way -- e.g. admin analytics
 * over all votes, CSV import, writing audit log entries. Never use this to
 * cast, edit, or delete an individual member's vote -- the one sanctioned
 * exception is resetPositionVotes() in app/actions/admin.ts, which deletes
 * *all* votes for a position at once (never a single voter's ballot) and is
 * the only caller the votes table's block_vote_mutation trigger permits to
 * delete rows at all.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
