import { Hourglass, PartyPopper, ShieldCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/election/site-header";
import { PositionResultCard } from "@/components/results/position-result-card";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { getActivePositions, getAllPositionResults, getCurrentElection } from "@/lib/voting/queries";
import { formatDateTime } from "@/lib/utils";
import type { AiSummary } from "@/types/database";

export default async function ResultsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const election = await getCurrentElection(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {!election ? (
          <EmptyState
            icon={<Hourglass className="h-6 w-6" />}
            title="No election results are available yet."
            description="Once an administrator configures and closes an election, results will appear here."
          />
        ) : election.status !== "closed" ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Results are not available yet."
            description={
              election.status === "draft"
                ? `Voting has not opened yet. ${election.name} opens on ${formatDateTime(election.start_at)}.`
                : "Voting is currently open. To keep the process fair, live results are hidden until voting closes."
            }
          />
        ) : (
          <ClosedResults electionId={election.id} electionName={election.name} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

async function ClosedResults({ electionId, electionName }: { electionId: string; electionName: string }) {
  const supabase = await createClient();
  const positions = await getActivePositions(supabase, electionId);
  const results = await getAllPositionResults(supabase, positions);

  const { data: summaries } = await supabase
    .from("ai_summaries")
    .select("*")
    .eq("election_id", electionId);

  const summaryByPosition = new Map<string, AiSummary>();
  for (const s of summaries ?? []) summaryByPosition.set(s.position_id, s);

  return (
    <div className="space-y-10">
      <div className="text-center">
        <PartyPopper className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Election Complete
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {electionName}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Congratulations to our elected Welfare Board! Results below are calculated directly
          from recorded votes.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {results.map((result) => (
          <PositionResultCard
            key={result.position.id}
            result={result}
            aiSummary={summaryByPosition.get(result.position.id) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
