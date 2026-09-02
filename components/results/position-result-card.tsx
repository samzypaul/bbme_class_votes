import { Sparkles, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResultsBarChart } from "@/components/results/results-bar-chart";
import { percentage } from "@/lib/utils";
import type { PositionResult } from "@/lib/voting/queries";
import type { AiSummary } from "@/types/database";

export function PositionResultCard({
  result,
  aiSummary,
}: {
  result: PositionResult;
  aiSummary: AiSummary | null;
}) {
  const { position, results, top5, totalVotes, winners, isTie } = result;
  const winnerIds = new Set(winners.map((w) => w.candidate_id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base uppercase tracking-wide text-primary">
          {position.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No votes were cast for this position.</p>
        ) : isTie ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Tie</p>
            <div className="mt-2 space-y-1">
              {winners.map((w) => (
                <p key={w.candidate_id} className="font-semibold text-amber-900">
                  {w.candidate_name} &mdash; {w.vote_count} votes
                </p>
              ))}
            </div>
            <p className="mt-2 text-sm text-amber-800">
              The election has resulted in a tie. Please contact the administrator for the next
              step.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
            <Trophy className="mx-auto h-7 w-7 text-green-600" />
            <p className="mt-2 text-lg font-black text-green-900">{winners[0].candidate_name}</p>
            <p className="text-sm font-semibold text-green-800">
              {winners[0].vote_count} Votes &middot;{" "}
              {percentage(Number(winners[0].vote_count), totalVotes)}% of votes
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-green-700">
              Congratulations!
            </p>
          </div>
        )}

        {top5.length > 0 && (
          <ResultsBarChart data={top5} totalVotes={totalVotes} winnerIds={winnerIds} />
        )}

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI Election Summary
          </p>
          {aiSummary ? (
            <p className="text-sm leading-relaxed text-foreground">{aiSummary.summary}</p>
          ) : (
            <Alert variant="warning">
              <AlertDescription>
                Results are available, but the AI summary could not be generated right now. An
                administrator can try again later.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
