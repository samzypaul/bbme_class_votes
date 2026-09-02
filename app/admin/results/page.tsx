import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminResults } from "@/components/admin/admin-results";
import { ElectionSwitcher } from "@/components/admin/election-switcher";
import { createClient } from "@/lib/supabase/server";
import { getActivePositions, getAllPositionResults } from "@/lib/voting/queries";
import { autoCloseIfExpired } from "@/lib/voting/election-lifecycle";
import type { AiSummary, PositionResultHistory } from "@/types/database";

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ election?: string }>;
}) {
  const { election: electionIdParam } = await searchParams;
  const supabase = await createClient();

  const { data: elections } = await supabase
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false });

  if (!elections || elections.length === 0) {
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

  const selected =
    elections.find((e) => e.id === electionIdParam) ??
    elections.find((e) => e.status === "open") ??
    elections.find((e) => e.status === "draft") ??
    elections[0];

  const election = await autoCloseIfExpired(selected);

  const [positions, { count: totalClassMembers }, { data: summaries }, { data: history }] = await Promise.all([
    getActivePositions(supabase, election.id),
    supabase.from("class_members").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("ai_summaries").select("*").eq("election_id", election.id),
    supabase
      .from("position_result_history")
      .select("*")
      .eq("election_id", election.id)
      .order("reset_at", { ascending: false }),
  ]);

  const results = await getAllPositionResults(supabase, positions);
  const summaryMap = new Map<string, AiSummary>((summaries ?? []).map((s) => [s.position_id, s]));
  const historyByPosition = new Map<string, PositionResultHistory[]>();
  for (const row of history ?? []) {
    const list = historyByPosition.get(row.position_id) ?? [];
    list.push(row);
    historyByPosition.set(row.position_id, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground">Results</h1>
          <p className="text-sm text-muted-foreground">{election.name}</p>
        </div>
        <ElectionSwitcher elections={elections} currentId={election.id} />
      </div>
      <AdminResults
        electionId={election.id}
        results={results}
        summaries={summaryMap}
        historyByPosition={historyByPosition}
        totalRegisteredVoters={totalClassMembers ?? 0}
      />
    </div>
  );
}
