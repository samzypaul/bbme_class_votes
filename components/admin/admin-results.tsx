"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsBarChart } from "@/components/results/results-bar-chart";
import { generateAiSummary } from "@/app/actions/admin";
import { percentage } from "@/lib/utils";
import type { PositionResult } from "@/lib/voting/queries";
import type { AiSummary } from "@/types/database";

export function AdminResults({
  electionId,
  results,
  summaries,
  totalRegisteredVoters,
}: {
  electionId: string;
  results: PositionResult[];
  summaries: Map<string, AiSummary>;
  totalRegisteredVoters: number;
}) {
  return (
    <div className="space-y-6">
      {results.map((result) => (
        <PositionAdminCard
          key={result.position.id}
          electionId={electionId}
          result={result}
          summary={summaries.get(result.position.id) ?? null}
          totalRegisteredVoters={totalRegisteredVoters}
        />
      ))}
    </div>
  );
}

function PositionAdminCard({
  electionId,
  result,
  summary,
  totalRegisteredVoters,
}: {
  electionId: string;
  result: PositionResult;
  summary: AiSummary | null;
  totalRegisteredVoters: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { position, results, top5, totalVotes, winners, isTie } = result;
  const winnerIds = new Set(winners.map((w) => w.candidate_id));
  const turnout = totalRegisteredVoters > 0 ? percentage(totalVotes, totalRegisteredVoters) : 0;

  function generate() {
    startTransition(async () => {
      const res = await generateAiSummary(electionId, position.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not generate summary.");
        return;
      }
      toast.success("AI summary generated.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base uppercase tracking-wide text-primary">
          {position.name}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={generate} loading={isPending}>
          <Sparkles />
          {summary ? "Regenerate Summary" : "Generate AI Summary"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Total Votes" value={totalVotes} />
          <Stat label="Turnout" value={`${turnout}%`} />
          <Stat label="Top Candidate" value={winners[0]?.candidate_name ?? "--"} />
          <Stat label={isTie ? "Result" : "Margin"} value={isTie ? "Tie" : marginLabel(results)} />
        </div>

        {top5.length > 0 ? (
          <ResultsBarChart data={top5} totalVotes={totalVotes} winnerIds={winnerIds} />
        ) : (
          <p className="text-sm text-muted-foreground">No votes recorded yet.</p>
        )}

        {summary && (
          <div className="rounded-lg bg-secondary p-3 text-sm">
            <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">
              Saved AI Summary
            </p>
            <p>{summary.summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function marginLabel(results: PositionResult["results"]) {
  if (results.length < 2) return "--";
  return `${Number(results[0].vote_count) - Number(results[1].vote_count)} votes`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-secondary p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-bold text-foreground">{value}</p>
    </div>
  );
}
