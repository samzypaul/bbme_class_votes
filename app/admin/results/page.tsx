import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminResults } from "@/components/admin/admin-results";
import { createClient } from "@/lib/supabase/server";
import { getActivePositions, getAllPositionResults, getCurrentElection } from "@/lib/voting/queries";
import type { AiSummary } from "@/types/database";

export default async function AdminResultsPage() {
  const supabase = await createClient();
  const election = await getCurrentElection(supabase);

  if (!election) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-bold text-foreground">No election yet</p>
          <Button asChild size="sm">
            <Link href="/admin/elections">Create Election</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const [positions, { count: totalClassMembers }, { data: summaries }] = await Promise.all([
    getActivePositions(supabase, election.id),
    supabase.from("class_members").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("ai_summaries").select("*").eq("election_id", election.id),
  ]);

  const results = await getAllPositionResults(supabase, positions);
  const summaryMap = new Map<string, AiSummary>((summaries ?? []).map((s) => [s.position_id, s]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Results</h1>
        <p className="text-sm text-muted-foreground">{election.name}</p>
      </div>
      <AdminResults
        electionId={election.id}
        results={results}
        summaries={summaryMap}
        totalRegisteredVoters={totalClassMembers ?? 0}
      />
    </div>
  );
}
