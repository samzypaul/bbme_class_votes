"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResultsBarChart } from "@/components/results/results-bar-chart";
import { generateAiSummary, resetPositionVotes } from "@/app/actions/admin";
import { formatDateTime, percentage } from "@/lib/utils";
import type { PositionResult } from "@/lib/voting/queries";
import type { AiSummary, PositionResultHistory } from "@/types/database";

export function AdminResults({
  electionId,
  results,
  summaries,
  historyByPosition,
  totalRegisteredVoters,
}: {
  electionId: string;
  results: PositionResult[];
  summaries: Map<string, AiSummary>;
  historyByPosition: Map<string, PositionResultHistory[]>;
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
          history={historyByPosition.get(result.position.id) ?? []}
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
  history,
  totalRegisteredVoters,
}: {
  electionId: string;
  result: PositionResult;
  summary: AiSummary | null;
  history: PositionResultHistory[];
  totalRegisteredVoters: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
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

  function resetVotes() {
    if (
      !confirm(
        `Delete all ${totalVotes} vote(s) for ${position.name}? Members will be able to vote again for this position. This cannot be undone.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await resetPositionVotes(position.id);
      if (!res.ok) {
        toast.error(res.error ?? "Could not reset votes.");
        return;
      }
      toast.success(`Votes for ${position.name} have been reset.`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base uppercase tracking-wide text-primary">
          {position.name}
        </CardTitle>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
              <History />
              History ({history.length})
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={resetVotes}
            loading={isPending}
            disabled={totalVotes === 0}
            className="text-destructive hover:text-destructive"
          >
            <RotateCcw />
            Reset Votes
          </Button>
          <Button size="sm" variant="outline" onClick={generate} loading={isPending}>
            <Sparkles />
            {summary ? "Regenerate Summary" : "Generate AI Summary"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Total Votes" value={totalVotes} />
          <Stat label="Turnout" value={`${turnout}%`} />
          <Stat label="Top Candidate" value={winners[0]?.candidate_name ?? "--"} />
          <Stat label={isTie ? "Result" : "Margin"} value={isTie ? "Tie" : marginLabel(results)} />
        </div>

        {totalVotes > 0 && top5.length > 0 ? (
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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Past polls &mdash; {position.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-4 overflow-auto">
            {history.map((snapshot) => (
              <div key={snapshot.id} className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Reset on {formatDateTime(snapshot.reset_at)} &middot; {snapshot.total_votes} vote(s)
                </p>
                <div className="space-y-1">
                  {snapshot.results.map((row) => (
                    <div key={row.candidate_id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{row.candidate_name}</span>
                      <span className="font-semibold text-muted-foreground">
                        {row.vote_count} votes &middot;{" "}
                        {percentage(Number(row.vote_count), snapshot.total_votes)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
